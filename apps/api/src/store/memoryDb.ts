import { and, eq } from "drizzle-orm";
import { memories } from "@bobai/db";

let dbPromise: Promise<typeof import("@bobai/db").db | null> | null = null;
async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbPromise) dbPromise = import("@bobai/db").then((module) => module.db).catch(() => null);
  return dbPromise;
}

export async function dbRemember(input: { workspaceId: string; userId?: string; key: string; value: string }) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: memories.id }).from(memories).where(and(eq(memories.workspaceId, input.workspaceId), eq(memories.content, input.value))).limit(1);
  if (existing.length) return true;
  await db.insert(memories).values({ workspaceId: input.workspaceId, userId: input.userId, category: input.key, content: input.value, summary: input.key });
  return true;
}

export async function dbRecallAll(workspaceId: string, userId?: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(memories).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined));
  return rows.map((row) => ({ key: row.category, value: row.content }));
}

export async function dbClearMemory(workspaceId: string, userId?: string) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(memories).where(and(eq(memories.workspaceId, workspaceId), userId ? eq(memories.userId, userId) : undefined));
  return true;
}
