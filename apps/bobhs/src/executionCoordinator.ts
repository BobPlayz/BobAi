import { DurableJobQueue, type DurableJob } from "./durableQueue.js";
import { ModelLifecycleManager } from "./modelLifecycle.js";
import { BoundedEventBuffer, retryDelay, type JobPriority } from "./runtimePolicy.js";

export interface ExecutionPayload {
  model: string;
  priority?: JobPriority;
  [key: string]: unknown;
}

export class BobHSExecutionCoordinator {
  constructor(
    private readonly queue: DurableJobQueue<ExecutionPayload>,
    private readonly models: ModelLifecycleManager,
    private readonly events = new BoundedEventBuffer(),
  ) {}

  async enqueue(type: string, payload: ExecutionPayload, idempotencyKey?: string) {
    return this.queue.enqueue(type, payload, { idempotencyKey });
  }

  async runOnce(workerId: string, execute: (job: DurableJob<ExecutionPayload>) => Promise<unknown>) {
    const job = await this.queue.claim(workerId);
    if (!job) return undefined;
    const started = Date.now();
    const model = await this.models.acquire(job.payload.model).catch(async error => {
      await this.queue.fail(job.id, workerId, error instanceof Error ? error.message : "model unavailable", retryDelay(job.attempts));
      this.events.push({ at: new Date().toISOString(), type: "model-unavailable", jobId: job.id, workerId, durationMs: Date.now() - started });
      return undefined;
    });
    if (!model) return job;
    try {
      const result = await execute(job);
      await this.queue.succeed(job.id, workerId, result);
      this.events.push({ at: new Date().toISOString(), type: "execution-succeeded", jobId: job.id, workerId, durationMs: Date.now() - started });
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : "execution failed";
      await this.queue.fail(job.id, workerId, message, retryDelay(job.attempts));
      this.events.push({ at: new Date().toISOString(), type: "execution-failed", jobId: job.id, workerId, durationMs: Date.now() - started, detail: { error: message } });
      return job;
    } finally {
      model.release();
    }
  }

  async cancel(jobId: string) { return this.queue.cancel(jobId); }
  async drain(workerId: string) { return this.queue.drain(workerId); }
  listEvents() { return this.events.list(); }
}
