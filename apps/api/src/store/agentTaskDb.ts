import { and, eq, inArray } from "drizzle-orm";
import { tasks } from "@bobai/db";

let dbPromise: Promise<typeof import("@bobai/db").db | null> | null = null;
async function getDb() { if (!process.env.DATABASE_URL) return null; if (!dbPromise) dbPromise = import("@bobai/db").then((module) => module.db).catch(() => null); return dbPromise; }

export async function persistAgentTask(input: { id: string; workspaceId?: string; createdBy?: string; title: string; description: string; type: string; status: string; payload?: unknown; result?: unknown; error?: string; metadata?: unknown }) {
  const db = await getDb(); if (!db || !input.workspaceId) return false;
  const metadata = input.metadata ?? (input.error ? { error: input.error } : undefined);
  await db.insert(tasks).values({ id: input.id, workspaceId: input.workspaceId, createdBy: input.createdBy, title: input.title, description: input.description, type: input.type, status: input.status, payload: input.payload, result: input.result, metadata }).onConflictDoUpdate({ target: tasks.id, set: { workspaceId: input.workspaceId, createdBy: input.createdBy, title: input.title, description: input.description, type: input.type, status: input.status, payload: input.payload, result: input.result, metadata, updatedAt: new Date() } });
  return true;
}

export async function updatePersistedAgentTask(input: { id: string; status: string; result?: unknown; error?: string; payload?: unknown; metadata?: unknown }) {
  const db = await getDb(); if (!db) return false;
  const now = new Date(); const update: Record<string, unknown> = { status: input.status, updatedAt: now };
  if (input.result !== undefined) update.result = input.result;
  if (input.payload !== undefined) update.payload = input.payload;
  if (input.metadata !== undefined) update.metadata = input.metadata;
  if (input.error) update.metadata = { ...(typeof input.metadata === "object" && input.metadata ? input.metadata as Record<string, unknown> : {}), error: input.error };
  if (input.status === "running") update.startedAt = now;
  if (input.status === "completed" || input.status === "cancelled") update.completedAt = now;
  if (input.status === "failed") update.failedAt = now;
  await db.update(tasks).set(update as never).where(eq(tasks.id, input.id)); return true;
}

export async function getPersistedAgentTask(id: string, userId: string) {
  const db = await getDb(); if (!db) return null;
  const [task] = await db.select({ id: tasks.id, workspaceId: tasks.workspaceId, createdBy: tasks.createdBy, title: tasks.title, description: tasks.description, type: tasks.type, status: tasks.status, payload: tasks.payload, result: tasks.result, metadata: tasks.metadata, createdAt: tasks.createdAt, startedAt: tasks.startedAt, completedAt: tasks.completedAt, failedAt: tasks.failedAt }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.createdBy, userId))).limit(1); return task ?? null;
}

export async function cancelPersistedAgentTask(id: string, userId: string) {
  const db = await getDb(); if (!db) return null; const now = new Date();
  const [task] = await db.update(tasks).set({ status: "cancelled", completedAt: now, updatedAt: now, metadata: { cancellationRequestedAt: now.toISOString() } }).where(and(eq(tasks.id, id), eq(tasks.createdBy, userId), inArray(tasks.status, ["queued", "running", "waiting"]))).returning({ id: tasks.id, status: tasks.status }); return task ?? null;
}

export async function markInterruptedAgentTasks() { const db = await getDb(); if (!db) return false; const now = new Date(); await db.update(tasks).set({ status: "failed", failedAt: now, updatedAt: now, metadata: { error: "agent worker restarted before the task completed" } }).where(and(inArray(tasks.type, ["coding", "automation", "project", "media", "database"]), eq(tasks.status, "running"))); return true; }
export async function listRecoverableAgentTasks() { const db = await getDb(); if (!db) return []; return db.select({ id: tasks.id, workspaceId: tasks.workspaceId, createdBy: tasks.createdBy, title: tasks.title, description: tasks.description, type: tasks.type, status: tasks.status, payload: tasks.payload, createdAt: tasks.createdAt }).from(tasks).where(and(inArray(tasks.type, ["coding", "automation", "project", "media", "database"]), eq(tasks.status, "queued"))); }
