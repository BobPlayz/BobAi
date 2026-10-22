import type { ModelProblem } from "./ollamaProvider.js";

/**
 * In-memory record of how each model actually behaved in this server process: successes, failures, time to first
 * token, and temporary cooldowns after rate limits, overload or timeouts. Holds model names and numbers only.
 */
export type ModelHealth = {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  /** Exponentially weighted averages in milliseconds. */
  firstTokenMs?: number;
  totalMs?: number;
  /** The model answered at least once, so the account can use it. */
  verified: boolean;
  cooldownUntil?: number;
  /** Not available to this account / not installed; skipped until this time. */
  deniedUntil?: number;
  lastProblem?: ModelProblem;
};

const health = new Map<string, ModelHealth>();
const WEIGHT = 0.3;

function entry(model: string): ModelHealth {
  let value = health.get(model);
  if (!value) { value = { successes: 0, failures: 0, consecutiveFailures: 0, verified: false }; health.set(model, value); }
  return value;
}

const average = (previous: number | undefined, sample: number) => previous === undefined ? sample : previous * (1 - WEIGHT) + sample * WEIGHT;

export function recordSuccess(model: string, timing: { firstTokenMs?: number; totalMs: number }) {
  const value = entry(model);
  value.successes += 1;
  value.consecutiveFailures = 0;
  value.verified = true;
  value.cooldownUntil = undefined;
  value.deniedUntil = undefined;
  value.lastProblem = undefined;
  if (timing.firstTokenMs !== undefined) value.firstTokenMs = average(value.firstTokenMs, timing.firstTokenMs);
  value.totalMs = average(value.totalMs, timing.totalMs);
}

export function recordFailure(model: string, problem: ModelProblem, now = Date.now()) {
  const value = entry(model);
  value.failures += 1;
  value.consecutiveFailures += 1;
  value.lastProblem = problem;
  if (problem === "access_denied" || problem === "model_missing") { value.deniedUntil = now + 60 * 60_000; value.verified = false; return; }
  const cooldown = problem === "rate_limited" ? 60_000 : problem === "busy" ? 30_000 : problem === "timeout" ? 2 * 60_000
    : value.consecutiveFailures >= 2 ? 2 * 60_000 : 0;
  if (cooldown) value.cooldownUntil = now + cooldown;
}

export function getHealth(model: string): ModelHealth | undefined { return health.get(model); }

export function isDenied(model: string, now = Date.now()) { const value = health.get(model); return Boolean(value?.deniedUntil && value.deniedUntil > now); }
export function isCoolingDown(model: string, now = Date.now()) { const value = health.get(model); return Boolean(value?.cooldownUntil && value.cooldownUntil > now); }

/** Laplace-smoothed success rate: 0.5 for a model with no history. */
export function reliability(model: string) { const value = health.get(model); return ((value?.successes ?? 0) + 1) / ((value?.successes ?? 0) + (value?.failures ?? 0) + 2); }

export function healthSnapshot() { return Object.fromEntries(health); }

/** For tests. */
export function resetHealth() { health.clear(); }
