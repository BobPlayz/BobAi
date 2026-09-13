import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export interface RuntimeCounters {
  accepted: number;
  completed: number;
  failed: number;
  retried: number;
  cancelled: number;
  totalLatencyMs: number;
}

export class RuntimeMetrics {
  private readonly counters: RuntimeCounters = { accepted: 0, completed: 0, failed: 0, retried: 0, cancelled: 0, totalLatencyMs: 0 };
  private readonly startedAt = Date.now();
  accept() { this.counters.accepted++; }
  complete(latencyMs: number) { this.counters.completed++; this.counters.totalLatencyMs += Math.max(0, latencyMs); }
  fail() { this.counters.failed++; }
  retry() { this.counters.retried++; }
  cancel() { this.counters.cancelled++; }
  snapshot() {
    const completed = this.counters.completed;
    return { ...this.counters, uptimeMs: Date.now() - this.startedAt, averageLatencyMs: completed ? this.counters.totalLatencyMs / completed : 0, successRate: completed ? (completed - this.counters.failed) / completed : 1 };
  }
}

export interface HealthCheck { name: string; ok: boolean; detail?: string; }
export async function runHealthChecks(checks: Array<() => Promise<HealthCheck>>): Promise<{ ok: boolean; checks: HealthCheck[] }> {
  const results: HealthCheck[] = [];
  for (const check of checks) {
    try { results.push(await check()); } catch (error) { results.push({ name: "unknown", ok: false, detail: error instanceof Error ? error.message : "health check failed" }); }
  }
  return { ok: results.every(result => result.ok), checks: results };
}

export async function verifyFileDigest(path: string, expectedSha256: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("invalid SHA-256 digest");
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex") === expectedSha256.toLowerCase();
}
