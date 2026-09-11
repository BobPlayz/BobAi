import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, documentChunks, uploads } from "@bobai/db";
import { generateEmbedding } from "./embeddings.js";

const CHUNK_SIZE = 4_000;
const CHUNK_OVERLAP = 400;
const MAX_CHUNKS = 2_000;

function stableUuid(uploadId: string, index: number) {
  const hex = createHash("sha256").update(`${uploadId}:${index}`).digest("hex").slice(0, 32);
  const chars = hex.split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20).join("")}`;
}

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const safeSize = Math.max(500, Math.min(20_000, Math.floor(size)));
  const safeOverlap = Math.max(0, Math.min(Math.floor(safeSize / 2), Math.floor(overlap)));
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(normalized.length, start + safeSize);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("\n", end), normalized.lastIndexOf(" ", end));
      if (boundary > start + safeSize * 0.6) end = boundary;
    }
    const value = normalized.slice(start, end).trim();
    if (value) chunks.push(value);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - safeOverlap);
  }
  return chunks;
}

export async function indexUpload(uploadId: string, workspaceId: string, projectId?: string) {
  const [upload] = await db.select({ id: uploads.id, text: uploads.extractedText }).from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, workspaceId))).limit(1);
  if (!upload) throw new Error("upload not found");
  const chunks = chunkText(upload.text || "");
  await db.delete(documentChunks).where(and(eq(documentChunks.uploadId, uploadId), eq(documentChunks.workspaceId, workspaceId)));
  if (!chunks.length) return { uploadId, chunks: 0, embedded: 0 };
  let embedded = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index];
    const embedding = await generateEmbedding(content);
    await db.insert(documentChunks).values({ id: stableUuid(uploadId, index), workspaceId, uploadId, projectId, chunkIndex: index, content, embedding, metadata: { indexedAt: new Date().toISOString() } });
    if (embedding) embedded += 1;
  }
  return { uploadId, chunks: chunks.length, embedded };
}

export async function searchDocumentChunks(workspaceId: string, userId: string, query: string, projectId?: string, limit = 12) {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const vector = await generateEmbedding(query);
  if (vector) {
    const projectFilter = projectId ? sql`and c.project_id = ${projectId}` : sql``;
    const rows = await db.execute(sql`select c.id, c.upload_id as "uploadId", c.project_id as "projectId", c.chunk_index as "chunkIndex", c.content, c.metadata, 1 - (c.embedding <=> ${JSON.stringify(vector)}::vector) as similarity from document_chunks c inner join uploads u on u.id = c.upload_id where c.workspace_id = ${workspaceId} and u.uploaded_by = ${userId} and u.deleted_at is null and c.embedding is not null ${projectFilter} order by c.embedding <=> ${JSON.stringify(vector)}::vector limit ${safeLimit}`);
    return rows as unknown as Array<Record<string, unknown>>;
  }
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const projectFilter = projectId ? sql`and c.project_id = ${projectId}` : sql``;
  const rows = await db.execute(sql`select c.id, c.upload_id as "uploadId", c.project_id as "projectId", c.chunk_index as "chunkIndex", c.content, c.metadata from document_chunks c inner join uploads u on u.id = c.upload_id where c.workspace_id = ${workspaceId} and u.uploaded_by = ${userId} and u.deleted_at is null ${projectFilter} and c.content ilike ${pattern} escape '\\' order by c.chunk_index asc limit ${safeLimit}`);
  return rows as unknown as Array<Record<string, unknown>>;
}
