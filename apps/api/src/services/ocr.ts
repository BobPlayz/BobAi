import { createWorker } from "tesseract.js";
import { and, eq } from "drizzle-orm";
import { db, uploads } from "@bobai/db";
import { indexUpload } from "./documentIndexer.js";

const MAX_OCR_BYTES = 12 * 1024 * 1024;
const MAX_OCR_TEXT = 1_000_000;

export async function ocrUpload(uploadId: string, workspaceId: string, image: Buffer) {
  if (image.length > MAX_OCR_BYTES) throw new Error("image is too large for OCR");
  const [upload] = await db.select({ projectId: uploads.projectId, metadata: uploads.metadata }).from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, workspaceId))).limit(1);
  if (!upload) throw new Error("upload not found");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(image);
    const text = result.data.text.trim().slice(0, MAX_OCR_TEXT);
    const previousMetadata = upload.metadata && typeof upload.metadata === "object" && !Array.isArray(upload.metadata) ? upload.metadata as Record<string, unknown> : {};
    await db.update(uploads).set({ extractedText: text || "[image uploaded; OCR found no text]", updatedAt: new Date(), metadata: { ...previousMetadata, processing: "indexed", ocr: "tesseract", ocrAt: new Date().toISOString() } }).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, workspaceId)));
    await indexUpload(uploadId, workspaceId, upload.projectId || undefined);
    return { uploadId, characters: text.length };
  } finally { await worker.terminate(); }
}
