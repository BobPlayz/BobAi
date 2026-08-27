import { createHash } from "node:crypto";

export type JobBudget = { maxSeconds?: number; maxOutputBytes?: number; maxAttempts?: number };
const DEFAULTS: Required<JobBudget> = { maxSeconds: 900, maxOutputBytes: 512 * 1024 * 1024, maxAttempts: 3 };

export const normalizeBudget = (budget?: JobBudget): Required<JobBudget> => ({
  maxSeconds: Math.min(Math.max(budget?.maxSeconds ?? DEFAULTS.maxSeconds, 1), 86_400),
  maxOutputBytes: Math.min(Math.max(budget?.maxOutputBytes ?? DEFAULTS.maxOutputBytes, 1), 4 * 1024 * 1024 * 1024),
  maxAttempts: Math.min(Math.max(budget?.maxAttempts ?? DEFAULTS.maxAttempts, 1), 5)
});

export const idempotencyKey = (userId: string, operation: string, input: unknown) => createHash("sha256").update(JSON.stringify([userId, operation, input])).digest("hex");
