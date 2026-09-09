import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db, uploads } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 5 * 1024 * 1024;
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: MAX_FILE_SIZE,
    fields: 8,
    fieldSize: 16 * 1024,
    parts: 10,
    headerPairs: 100,
    fieldArrayIndexLimit: 100,
  },
});

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "file exceeds the 10 MB size limit" : "upload failed" });
    return res.status(400).json({ error: "file upload failed" });
  });
}

function isPdf(buffer: Buffer) { return buffer.subarray(0, 5).toString("ascii") === "%PDF-"; }
function isPng(buffer: Buffer) { return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); }
function isJpeg(buffer: Buffer) { return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; }
function isGif(buffer: Buffer) { return buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a"); }
function isWebp(buffer: Buffer) { return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"; }
function isSupportedTextType(mimetype: string) { return /^text\/(plain|markdown|csv|html|css|javascript|xml)$/i.test(mimetype); }
function safeName(name: string) { return name.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "_").slice(0, 255); }

router.get("/", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 200) : "";
    const rows = query
      ? await db.select({ id: uploads.id, name: uploads.originalName, type: uploads.mimeType, size: uploads.size, checksum: uploads.checksum, createdAt: uploads.createdAt }).from(uploads).where(and(eq(uploads.workspaceId, workspace.id), eq(uploads.uploadedBy, req.user!.id), ilike(uploads.originalName, `%${query}%`))).orderBy(desc(uploads.createdAt)).limit(50)
      : await db.select({ id: uploads.id, name: uploads.originalName, type: uploads.mimeType, size: uploads.size, checksum: uploads.checksum, createdAt: uploads.createdAt }).from(uploads).where(and(eq(uploads.workspaceId, workspace.id), eq(uploads.uploadedBy, req.user!.id))).orderBy(desc(uploads.createdAt)).limit(50);
    return res.json({ files: rows });
  } catch { return res.status(503).json({ error: "file storage unavailable" }); }
});

router.post("/search", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, 200) : "";
  if (!query) return res.status(400).json({ error: "search query is required" });
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const rows = await db.select({ id: uploads.id, name: uploads.originalName, type: uploads.mimeType, text: uploads.extractedText, createdAt: uploads.createdAt }).from(uploads).where(and(eq(uploads.workspaceId, workspace.id), eq(uploads.uploadedBy, req.user!.id), ilike(uploads.extractedText, `%${query}%`))).orderBy(desc(uploads.createdAt)).limit(20);
    return res.json({ results: rows.map((row) => {
      const text = row.text || "";
      const lower = text.toLowerCase();
      const index = lower.indexOf(query.toLowerCase());
      const start = Math.max(0, index - 500);
      return { id: row.id, name: row.name, type: row.type, excerpt: text.slice(start, start + 1_500), createdAt: row.createdAt };
    }) });
  } catch { return res.status(503).json({ error: "file search unavailable" }); }
});

router.post("/upload", uploadMiddleware, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file uploaded" });
  try {
    if (file.size > MAX_FILE_SIZE) return res.status(413).json({ error: "file exceeds the 10 MB size limit" });
    const buffer = await fs.readFile(file.path);
    const { mimetype } = file;
    const checksum = createHash("sha256").update(buffer).digest("hex");
    let text = "";
    if (mimetype === "application/pdf") {
      if (!isPdf(buffer)) return res.status(415).json({ error: "file content does not match PDF type" });
      const parser = new PDFParse({ data: buffer });
      try { text = (await parser.getText()).text || ""; } finally { await parser.destroy(); }
    } else if (isSupportedTextType(mimetype)) text = buffer.toString("utf8");
    else if (mimetype === "image/png" || mimetype === "image/jpeg" || mimetype === "image/webp" || mimetype === "image/gif") {
      const validImage = mimetype === "image/png" ? isPng(buffer) : mimetype === "image/jpeg" ? isJpeg(buffer) : mimetype === "image/webp" ? isWebp(buffer) : isGif(buffer);
      if (!validImage) return res.status(415).json({ error: "file content does not match image type" });
      text = "[image uploaded]";
    } else return res.status(415).json({ error: "unsupported file type" });

    if (text.length > MAX_EXTRACTED_TEXT) return res.status(413).json({ error: "extracted document text exceeds the 5 MB limit" });
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const id = randomUUID();
    await db.insert(uploads).values({ id, workspaceId: workspace.id, uploadedBy: req.user!.id, storageKey: `extracted/${workspace.id}/${id}`, originalName: safeName(file.originalname), mimeType: mimetype, size: file.size, checksum, storageProvider: "database-extracted-text", metadata: { source: "upload", originalSize: file.size }, extractedText: text });
    return res.json({ id, name: safeName(file.originalname), type: mimetype, size: file.size, checksum, text });
  } catch { return res.status(500).json({ error: "failed to process file" }); }
  finally { await fs.unlink(file.path).catch(() => undefined); }
});

export default router;
