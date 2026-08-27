import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type ToolResult<T = unknown> = {
  ok: boolean;
  code: string;
  data?: T;
  error?: { message: string; retryable?: boolean };
  meta: { requestId: string; startedAt: string; finishedAt: string };
};

export function toolResult<T>(ok: boolean, code: string, data?: T, error?: ToolResult["error"], requestId = randomUUID(), startedAt = new Date().toISOString()): ToolResult<T> {
  return { ok, code, ...(data === undefined ? {} : { data }), ...(error ? { error } : {}), meta: { requestId, startedAt, finishedAt: new Date().toISOString() } };
}

export type AgentCapability = "coding" | "web" | "files" | "vision" | "image" | "video" | "music" | "database" | "automation";

export function hasCapabilities(granted: readonly AgentCapability[], required: readonly AgentCapability[]) {
  const set = new Set(granted);
  return required.every((capability) => set.has(capability));
}

export type JobBudget = { maxAttempts?: number; timeoutMs?: number; maxOutputBytes?: number; maxChildren?: number };

export function validateJobBudget(budget: JobBudget) {
  const checks: Array<[number | undefined, number, number]> = [
    [budget.maxAttempts, 1, 10],
    [budget.timeoutMs, 1_000, 86_400_000],
    [budget.maxOutputBytes, 1, 1_073_741_824],
    [budget.maxChildren, 0, 100],
  ];
  return checks.every(([value, min, max]) => value === undefined || Number.isInteger(value) && value >= min && value <= max);
}

export function signWebhook(payload: string, secret: string, timestamp: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function verifyWebhook(payload: string, secret: string, timestamp: string, signature: string, maxAgeMs = 5 * 60_000) {
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > maxAgeMs) return false;
  const expected = signWebhook(payload, secret, timestamp);
  const actual = Buffer.from(signature, "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export function idempotencyKey(userId: string, key: string) {
  return `${userId}:${key.trim().slice(0, 128)}`;
}
