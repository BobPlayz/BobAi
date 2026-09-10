import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { memories, memoryEmbeddings } from "@bobai/db";
import { generateEmbedding } from "../services/embeddings.js";
let dbPromise: Promise<typeof import("@bobai/db").db | null> | null = null;
async function getDb() { if (!process.env.DATABASE_URL) return null; if (!dbPromise) dbPromise = import("@bobai/db").then((module) => module.db).catch(() => null); return dbPromise; }
export function isSensitiveMemory(value: string) { return /\b(password|passcode|otp|one[- ]time code|api key|secret key|private key|credit card|cvv|cvc|bank account|routing number)\b/i.test(value); }

async function saveEmbedding(memoryId: string, content: string) {
  const db = await getDb(); if (!db) return false;
  const vector = await generateEmbedding(content); if (!vector) return false;
  const literal = JSON.stringify(vector);
  await db.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, memoryId));
  await db.insert(memoryEmbeddings).values({ memoryId, embedding: vector });
  return Boolean(literal);
}

export async function dbRemember(input: { workspaceId: string; userId?: string; key: string; value: string }) {
  if (isSensitiveMemory(input.value)) return false;
  const db = await getDb(); if (!db) return false;
  const existing = await db.select({ id: memories.id }).from(memories).where(and(eq(memories.workspaceId, input.workspaceId), input.userId ? eq(memories.userId, input.userId) : undefined, eq(memories.content, input.value), isNull(memories.deletedAt))).limit(1);
  if (existing.length) {
    await db.update(memories).set({ category: input.key, updatedAt: new Date(), lastAccessedAt: new Date() }).where(eq(memories.id, existing[0].id));
    void saveEmbedding(existing[0].id, input.value);
    return true;
  }
  const [created] = await db.insert(memories).values({ workspaceId: input.workspaceId, userId: input.userId, category: input.key, content: input.value, summary: input.key, importance: input.key === "explicit memory" ? 70 : 50 }).returning({ id: memories.id });
  if (created) void saveEmbedding(created.id, input.value);
  return Boolean(created);
}

export async function dbRecallAll(workspaceId: string, userId?: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(memories).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined, eq(memories.isArchived, false), isNull(memories.deletedAt))).orderBy(desc(memories.isPinned), desc(memories.importance), desc(memories.updatedAt));
  return rows;
}

export async function dbRecallRelevant(workspaceId: string, userId: string | undefined, query: string, limit = 12) {
  const db = await getDb(); if (!db) return [];
  const vector = await generateEmbedding(query);
  if (!vector) return (await dbRecallAll(workspaceId, userId))?.slice(0, limit) ?? [];
  const vectorLiteral = JSON.stringify(vector);
  const rows = await db.execute(sql`select m.* from memories m inner join memory_embeddings e on e.memory_id = m.id where m.workspace_id = ${workspaceId} and ${userId ? sql`m.user_id = ${userId}` : sql`true`} and m.is_archived = false and m.deleted_at is null order by e.embedding <=> ${vectorLiteral}::vector limit ${Math.min(50, Math.max(1, Math.floor(limit)))}`);
  return (rows as unknown as Array<Record<string, unknown>>).map((row) => row);
}

export async function dbUpdateMemory(id: string, workspaceId: string, userId: string, changes: { category?: string; content?: string; isPinned?: boolean; isArchived?: boolean; importance?: number }) {
  const db = await getDb(); if (!db || (changes.content && isSensitiveMemory(changes.content))) return null;
  const [row] = await db.update(memories).set({ ...changes, updatedAt: new Date() }).where(and(eq(memories.id, id), eq(memories.workspaceId, workspaceId), eq(memories.userId, userId), isNull(memories.deletedAt))).returning();
  if (row && changes.content) void saveEmbedding(row.id, changes.content);
  return row ?? null;
}
export async function dbDeleteMemory(id: string, workspaceId: string, userId: string) { const db = await getDb(); if (!db) return false; const [row] = await db.update(memories).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(memories.id, id), eq(memories.workspaceId, workspaceId), eq(memories.userId, userId), isNull(memories.deletedAt))).returning({ id: memories.id }); return Boolean(row); }
export async function dbClearMemory(workspaceId: string, userId?: string) { const db = await getDb(); if (!db) return false; await db.update(memories).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined, isNull(memories.deletedAt))); return true; }
