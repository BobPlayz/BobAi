import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

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

export class DurableJobQueue<T = unknown> {
  private readonly stateFile: string;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private state: QueueState = { version: 0, jobs: [] };
  private loaded = false;

  constructor(options: { stateFile: string; leaseMs?: number; maxAttempts?: number }) {
    this.stateFile = options.stateFile;
    this.leaseMs = Math.max(1_000, options.leaseMs ?? 30_000);
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  }

  async load(): Promise<void> {
    try {
      this.state = JSON.parse(await readFile(this.stateFile, "utf8")) as QueueState;
      if (!Array.isArray(this.state.jobs)) this.state = { version: 0, jobs: [] };
    } catch {
      this.state = { version: 0, jobs: [] };
    }
    this.requeueExpired(Date.now());
    this.loaded = true;
  }

  private ensureLoaded() { if (!this.loaded) throw new Error("queue must be loaded first"); }

  private async persist() {
    await mkdir(this.stateFile.substring(0, Math.max(0, this.stateFile.lastIndexOf("/"))) || ".", { recursive: true });
    const temp = `${this.stateFile}.${process.pid}.tmp`;
    this.state.version++;
    await writeFile(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
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
    if (options.idempotencyKey) {
      const existing = this.state.jobs.find(j => j.idempotencyKey === options.idempotencyKey);
      if (existing) return existing;
    }
    const now = Date.now();
    const job: DurableJob<T> = {
      id: randomUUID(), type, payload, status: "queued", attempts: 0,
      maxAttempts: Math.max(1, options.maxAttempts ?? this.maxAttempts),
      availableAt: options.availableAt ?? now, idempotencyKey: options.idempotencyKey,
      createdAt: now, updatedAt: now,
    };
    this.state.jobs.push(job);
    await this.persist();
    return job;
  }

  async claim(workerId: string, now = Date.now()): Promise<DurableJob<T> | undefined> {
    this.ensureLoaded();
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
  }

  async heartbeat(jobId: string, workerId: string, now = Date.now()): Promise<boolean> {
    this.ensureLoaded();
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || job.status !== "running" || job.workerId !== workerId) return false;
    job.leaseUntil = now + this.leaseMs;
    job.updatedAt = now;
    await this.persist();
    return true;
  }

  async succeed(jobId: string, workerId: string, result: unknown): Promise<boolean> {
    return this.finish(jobId, workerId, "succeeded", result);
  }

  async fail(jobId: string, workerId: string, error: string, retryDelayMs = 0): Promise<boolean> {
    this.ensureLoaded();
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || job.status !== "running" || job.workerId !== workerId) return false;
    const now = Date.now();
    if (job.attempts < job.maxAttempts) {
      job.status = "queued";
      job.availableAt = now + Math.max(0, retryDelayMs);
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
  }

  async cancel(jobId: string): Promise<boolean> {
    this.ensureLoaded();
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") return false;
    job.status = "cancelled";
    job.leaseUntil = undefined;
    job.workerId = undefined;
    job.updatedAt = Date.now();
    await this.persist();
    return true;
  }

  async drain(workerId: string): Promise<number> {
    this.ensureLoaded();
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
  }

  async list(): Promise<DurableJob<T>[]> { this.ensureLoaded(); this.requeueExpired(Date.now()); return this.state.jobs.map(j => ({ ...j })); }

  private async finish(jobId: string, workerId: string, status: "succeeded", result: unknown) {
    this.ensureLoaded();
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || job.status !== "running" || job.workerId !== workerId) return false;
    job.status = status;
    job.result = result;
    job.leaseUntil = undefined;
    job.workerId = undefined;
    job.updatedAt = Date.now();
    await this.persist();
    return true;
  }
}
