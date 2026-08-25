import { eq } from "drizzle-orm";
import { tasks } from "@bobai/db";

let dbPromise: Promise<typeof import("@bobai/db").db | null> | null = null;

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbPromise) {
    dbPromise = import("@bobai/db").then((module) => module.db).catch(() => null);
  }
  return dbPromise;
}

export async function persistAgentTask(input: {
  id: string;
  workspaceId?: string;
  createdBy?: string;
  title: string;
  description: string;
  type: string;
  status: string;
  payload?: unknown;
  result?: unknown;
  error?: string;
}) {
  const db = await getDb();
  if (!db || !input.workspaceId) return false;

  await db.insert(tasks).values({
    id: input.id,
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title: input.title,
    description: input.description,
    type: input.type,
    status: input.status,
    payload: input.payload,
    result: input.result,
    metadata: input.error ? { error: input.error } : undefined,
  });
  return true;
}

export async function updatePersistedAgentTask(input: {
  id: string;
  status: string;
  result?: unknown;
  error?: string;
}) {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();
  const update: Record<string, unknown> = { status: input.status, result: input.result, updatedAt: now };
  if (input.status === "running") update.startedAt = now;
  if (input.status === "completed") update.completedAt = now;
  if (input.status === "failed") update.failedAt = now;
  if (input.error) update.metadata = { error: input.error };

  await db.update(tasks).set(update as never).where(eq(tasks.id, input.id));
  return true;
}
