export type JobPriority = "low" | "normal" | "high" | "critical";

export interface CapacitySnapshot {
  queueDepth: number;
  running: number;
  maxRunning: number;
  draining: boolean;
}

export function canAccept(snapshot: CapacitySnapshot, priority: JobPriority) {
  if (snapshot.draining) return false;
  if (snapshot.running < snapshot.maxRunning) return true;
  return priority === "critical" && snapshot.queueDepth < snapshot.maxRunning * 4;
}

export function retryDelay(attempt: number, baseMs = 1_000, maxMs = 60_000) {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exponential = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
  const jitter = Math.floor(exponential * 0.2 * Math.random());
  return Math.min(maxMs, exponential + jitter);
}

export interface RuntimeEvent {
  at: string;
  type: string;
  jobId?: string;
  workerId?: string;
  durationMs?: number;
  detail?: Record<string, unknown>;
}

export class BoundedEventBuffer {
  private readonly events: RuntimeEvent[] = [];
  constructor(private readonly limit = 2_000) {}
  push(event: RuntimeEvent) {
    this.events.push(event);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
  }
  list() { return this.events.map(event => ({ ...event, detail: event.detail ? { ...event.detail } : undefined })); }
  clear() { this.events.length = 0; }
}
