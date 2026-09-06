import { and, desc, eq } from "drizzle-orm";
import { memories } from "@bobai/db";

let dbPromise: Promise<typeof import("@bobai/db").db | null> | null = null;
async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbPromise) dbPromise = import("@bobai/db").then((module) => module.db).catch(() => null);
  return dbPromise;
}

export function isSensitiveMemory(value: string) {
  return /\b(password|passcode|otp|one[- ]time code|api key|secret key|private key|credit card|cvv|cvc|bank account|routing number)\b/i.test(value);
}

export async function dbRemember(input: { workspaceId: string; userId?: string; key: string; value: string }) {
  if (isSensitiveMemory(input.value)) return false;
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: memories.id }).from(memories).where(and(eq(memories.workspaceId, input.workspaceId), input.userId ? eq(memories.userId, input.userId) : undefined, eq(memories.content, input.value))).limit(1);
  if (existing.length) {
    await db.update(memories).set({ category: input.key, updatedAt: new Date(), lastAccessedAt: new Date() }).where(eq(memories.id, existing[0].id));
    return true;
  }
  await db.insert(memories).values({ workspaceId: input.workspaceId, userId: input.userId, category: input.key, content: input.value, summary: input.key, importance: input.key === "explicit memory" ? 70 : 50 });
  return true;
}

export async function dbRecallAll(workspaceId: string, userId?: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(memories).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined, eq(memories.isArchived, false))).orderBy(desc(memories.isPinned), desc(memories.importance), desc(memories.updatedAt));
  return rows.filter((row) => !row.deletedAt).map((row) => ({ key: row.category, value: row.content }));
}

export async function dbClearMemory(workspaceId: string, userId?: string) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(memories).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined));
  return true;
}
