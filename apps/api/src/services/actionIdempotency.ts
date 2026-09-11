import { createHash } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { actionIdempotency, db } from "@bobai/db";
const KEY_MAX = 200; const ACTION_MAX = 120; const TTL_MS = 24 * 60 * 60 * 1000; const PROCESSING_TTL_MS = 10 * 60_000; const MAX_STORED_RESPONSE_BYTES = 1_000_000;
function stableJson(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`; }
function hashRequest(value: unknown) { return createHash("sha256").update(stableJson(value)).digest("hex"); }
export type IdempotencyClaim = { replay: false; id: string } | { replay: true; statusCode: number; response: unknown };
export async function claimIdempotency(input: { userId: string; workspaceId: string; action: string; key?: string; payload: unknown }): Promise<IdempotencyClaim | null> {
  const key = input.key?.trim(); if (!key) return null; if (key.length > KEY_MAX || !/^[A-Za-z0-9._:-]+$/.test(key)) throw new Error("invalid idempotency key"); if (input.action.length > ACTION_MAX || !/^[A-Za-z0-9._:-]+$/.test(input.action)) throw new Error("invalid idempotent action");
  const requestHash = hashRequest(input.payload); const now = new Date(); const expiresAt = new Date(now.getTime() + TTL_MS);
  const inserted = await db.insert(actionIdempotency).values({ userId: input.userId, workspaceId: input.workspaceId, action: input.action, key, requestHash, status: "processing", expiresAt }).onConflictDoNothing({ target: [actionIdempotency.userId, actionIdempotency.workspaceId, actionIdempotency.action, actionIdempotency.key] }).returning({ id: actionIdempotency.id });
  if (inserted[0]) return { replay: false, id: inserted[0].id };
  const [existing] = await db.select({ id: actionIdempotency.id, requestHash: actionIdempotency.requestHash, status: actionIdempotency.status, statusCode: actionIdempotency.statusCode, response: actionIdempotency.response, expiresAt: actionIdempotency.expiresAt, updatedAt: actionIdempotency.updatedAt }).from(actionIdempotency).where(and(eq(actionIdempotency.userId, input.userId), eq(actionIdempotency.workspaceId, input.workspaceId), eq(actionIdempotency.action, input.action), eq(actionIdempotency.key, key))).limit(1);
  if (!existing) return null;
  if (existing.requestHash !== requestHash) throw new Error("idempotency key was already used for a different request");
  if (existing.expiresAt <= now || (existing.status === "processing" && existing.updatedAt.getTime() + PROCESSING_TTL_MS <= now.getTime())) { await db.delete(actionIdempotency).where(eq(actionIdempotency.id, existing.id)); return claimIdempotency(input); }
  if (existing.status === "completed" && existing.statusCode && existing.response !== null) return { replay: true, statusCode: existing.statusCode, response: existing.response };
  throw new Error("idempotent action is already processing");
}
export async function completeIdempotency(id: string, statusCode: number, response: unknown) { const encoded = JSON.stringify(response); if (encoded.length > MAX_STORED_RESPONSE_BYTES) { await failIdempotency(id); return false; } await db.update(actionIdempotency).set({ status: "completed", statusCode, response, updatedAt: new Date() }).where(eq(actionIdempotency.id, id)); return true; }
export async function failIdempotency(id: string) { await db.delete(actionIdempotency).where(eq(actionIdempotency.id, id)); }
export async function cleanupIdempotency(now = new Date()) { const deleted = await db.delete(actionIdempotency).where(or(sql`${actionIdempotency.expiresAt} <= ${now}`, and(eq(actionIdempotency.status, "processing"), sql`${actionIdempotency.updatedAt} <= ${new Date(now.getTime() - PROCESSING_TTL_MS)}`))).returning({ id: actionIdempotency.id }); return deleted.length; }
