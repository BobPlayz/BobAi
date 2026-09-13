import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withFileLock } from "./fileLock.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface DurableJob<T = unknown> {
  id: string;
  idempotencyKey?: string;
  type: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: number;
  leaseUntil?: number;
  workerId?: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface QueueState { version: number; jobs: DurableJob[]; }

const MAX_STATE_BYTES = 16 * 1024 * 1024;
const MAX_JOBS = 2_000;
const MAX_TYPE_LENGTH = 128;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const MAX_WORKER_ID_LENGTH = 128;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_RESULT_BYTES = 256 * 1024;
const MAX_ERROR_BYTES = 8 * 1024;

function serializedBytes(value: unknown, label: string, maxBytes: number) {
  let text: string;
  try { text = JSON.stringify(value); } catch { throw new Error(`${label} must be JSON-serializable`); }
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`${label} exceeds the ${maxBytes} byte limit`);
  return text;
}

export class DurableJobQueue<T = unknown> {
  private readonly stateFile: string;
  private readonly lockPath: string;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private state: QueueState = { version: 0, jobs: [] };
  private loaded = false;

  constructor(options: { stateFile: string; leaseMs?: number; maxAttempts?: number; lockTimeoutMs?: number }) {
    this.stateFile = options.stateFile;
    this.lockPath = `${this.stateFile}.lock`;
    this.leaseMs = Math.max(1_000, options.leaseMs ?? 30_000);
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.lockTimeoutMs = Math.max(100, options.lockTimeoutMs ?? 10_000);
  }

  private readonly lockTimeoutMs: number;

  async load(): Promise<void> {
    this.state = await this.readState();
    this.requeueExpired(Date.now());
    this.loaded = true;
  }

  private ensureLoaded() { if (!this.loaded) throw new Error("queue must be loaded first"); }

  private async readState(): Promise<QueueState> {
    const info = await stat(this.stateFile).catch(() => null);
    if (!info) return { version: 0, jobs: [] };
    if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new Error("queue state file exceeds the 16 MB safety limit");
    let parsed: Partial<QueueState>;
    try { parsed = JSON.parse(await readFile(this.stateFile, "utf8")) as Partial<QueueState>; } catch { throw new Error("queue state file is invalid JSON"); }
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    if (jobs.length > MAX_JOBS) throw new Error("queue contains too many jobs");
    return { version: Number(parsed.version) || 0, jobs };
  }

  private async refresh() {
    this.state = await this.readState();
    this.requeueExpired(Date.now());
  }

  private async persist() {
    await mkdir(dirname(this.stateFile), { recursive: true });
    const temp = `${this.stateFile}.${process.pid}.${randomUUID()}.tmp`;
    this.state.version++;
    const text = serializedBytes(this.state, "queue state", MAX_STATE_BYTES);
    await writeFile(temp, text, { mode: 0o600 });
    await rename(temp, this.stateFile);
  }

  private requeueExpired(now: number) {
    for (const job of this.state.jobs) {
      if (job.status === "running" && job.leaseUntil !== undefined && job.leaseUntil <= now) {
        job.status = job.attempts >= job.maxAttempts ? "failed" : "queued";
        job.availableAt = now;
        job.leaseUntil = undefined;
        job.workerId = undefined;
        if (job.status === "failed") job.error = "worker lease expired after maximum attempts";
        job.updatedAt = now;
      }
    }
  }

  async enqueue(type: string, payload: T, options: { idempotencyKey?: string; maxAttempts?: number; availableAt?: number } = {}) {
    this.ensureLoaded();
    if (typeof type !== "string" || type.trim().length === 0 || type.length > MAX_TYPE_LENGTH) throw new Error("invalid job type");
    if (options.idempotencyKey !== undefined && (typeof options.idempotencyKey !== "string" || options.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH)) throw new Error("invalid idempotency key");
    serializedBytes(payload, "job payload", MAX_PAYLOAD_BYTES);
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      if (options.idempotencyKey) {
        const existing = this.state.jobs.find(j => j.idempotencyKey === options.idempotencyKey);
        if (existing) return { ...existing } as DurableJob<T>;
      }
      if (this.state.jobs.length >= MAX_JOBS) throw new Error("durable queue is full");
      const now = Date.now();
      const job: DurableJob<T> = {
        id: randomUUID(), type, payload, status: "queued", attempts: 0,
        maxAttempts: Math.min(20, Math.max(1, options.maxAttempts ?? this.maxAttempts)),
        availableAt: Number.isFinite(options.availableAt) ? Math.max(now, options.availableAt!) : now,
        idempotencyKey: options.idempotencyKey,
        createdAt: now, updatedAt: now,
      };
      this.state.jobs.push(job);
      await this.persist();
      return { ...job };
    }, this.lockTimeoutMs);
  }

  async claim(workerId: string, now = Date.now()): Promise<DurableJob<T> | undefined> {
    this.ensureLoaded();
    if (typeof workerId !== "string" || !workerId || workerId.length > MAX_WORKER_ID_LENGTH) throw new Error("invalid worker id");
    if (!Number.isFinite(now)) throw new Error("invalid claim timestamp");
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      this.requeueExpired(now);
      const job = this.state.jobs
        .filter(j => j.status === "queued" && j.availableAt <= now)
        .sort((a, b) => a.availableAt - b.availableAt || a.createdAt - b.createdAt)[0] as DurableJob<T> | undefined;
      if (!job) return undefined;
      job.status = "running";
      job.attempts++;
      job.workerId = workerId;
      job.leaseUntil = now + this.leaseMs;
      job.updatedAt = now;
      await this.persist();
      return { ...job };
    }, this.lockTimeoutMs);
  }

  async heartbeat(jobId: string, workerId: string, now = Date.now()): Promise<boolean> {
    this.ensureLoaded();
    if (!Number.isFinite(now)) return false;
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job || job.status !== "running" || job.workerId !== workerId) return false;
      job.leaseUntil = now + this.leaseMs;
      job.updatedAt = now;
      await this.persist();
      return true;
    }, this.lockTimeoutMs);
  }

  async succeed(jobId: string, workerId: string, result: unknown): Promise<boolean> {
    serializedBytes(result, "job result", MAX_RESULT_BYTES);
    return this.finish(jobId, workerId, "succeeded", result);
  }

  async fail(jobId: string, workerId: string, error: string, retryDelayMs = 0): Promise<boolean> {
    this.ensureLoaded();
    if (typeof error !== "string" || Buffer.byteLength(error, "utf8") > MAX_ERROR_BYTES) return false;
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job || job.status !== "running" || job.workerId !== workerId) return false;
      const now = Date.now();
      if (job.attempts < job.maxAttempts) {
        job.status = "queued";
        job.availableAt = now + Math.max(0, Math.min(86_400_000, retryDelayMs));
        job.error = error;
      } else {
        job.status = "failed";
        job.error = error;
      }
      job.leaseUntil = undefined;
      job.workerId = undefined;
      job.updatedAt = now;
      await this.persist();
      return true;
    }, this.lockTimeoutMs);
  }

  async cancel(jobId: string): Promise<boolean> {
    this.ensureLoaded();
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job || job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") return false;
      job.status = "cancelled";
      job.leaseUntil = undefined;
      job.workerId = undefined;
      job.updatedAt = Date.now();
      await this.persist();
      return true;
    }, this.lockTimeoutMs);
  }

  async drain(workerId: string): Promise<number> {
    this.ensureLoaded();
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      const now = Date.now();
      let changed = 0;
      for (const job of this.state.jobs) {
        if (job.status === "running" && job.workerId === workerId) {
          job.status = job.attempts >= job.maxAttempts ? "failed" : "queued";
          job.availableAt = now;
          job.leaseUntil = undefined;
          job.workerId = undefined;
          job.updatedAt = now;
          changed++;
        }
      }
      if (changed) await this.persist();
      return changed;
    }, this.lockTimeoutMs);
  }

  async list(): Promise<DurableJob<T>[]> {
    this.ensureLoaded();
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      return this.state.jobs.map(j => ({ ...j } as DurableJob<T>));
    }, this.lockTimeoutMs);
  }

  private async finish(jobId: string, workerId: string, status: "succeeded", result: unknown) {
    this.ensureLoaded();
    return withFileLock(this.lockPath, async () => {
      await this.refresh();
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job || job.status !== "running" || job.workerId !== workerId) return false;
      job.status = status;
      job.result = result;
      job.leaseUntil = undefined;
      job.workerId = undefined;
      job.updatedAt = Date.now();
      await this.persist();
      return true;
    }, this.lockTimeoutMs);
  }
}
