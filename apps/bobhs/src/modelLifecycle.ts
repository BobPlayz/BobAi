export type ModelState = "unavailable" | "starting" | "ready" | "stopping" | "error";

type Entry = {
  name: string;
  state: ModelState;
  refs: number;
  lastUsedAt: number;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  error?: string;
};

export class ModelLifecycleManager {
  private readonly entries = new Map<string, Entry>();

  register(name: string, hooks: { start?: () => Promise<void>; stop?: () => Promise<void> } = {}) {
    if (this.entries.has(name)) return;
    this.entries.set(name, { name, state: "unavailable", refs: 0, lastUsedAt: 0, ...hooks });
  }

  async acquire(name: string) {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`unknown model: ${name}`);
    if (entry.state === "error") throw new Error(entry.error || `model ${name} is unavailable`);
    if (entry.state === "unavailable") {
      entry.state = "starting";
      try {
        await entry.start?.();
        entry.state = "ready";
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model start failed";
        throw error;
      }
    } else if (entry.state === "stopping") {
      throw new Error(`model ${name} is stopping`);
    }
    entry.refs++;
    entry.lastUsedAt = Date.now();
    return { name, release: () => this.release(name) };
  }

  release(name: string) {
    const entry = this.entries.get(name);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsedAt = Date.now();
  }

  async evictIdle(maxIdleMs: number, now = Date.now()) {
    const evicted: string[] = [];
    for (const entry of this.entries.values()) {
      if (entry.state !== "ready" || entry.refs !== 0 || now - entry.lastUsedAt < maxIdleMs) continue;
      entry.state = "stopping";
      try {
        await entry.stop?.();
        entry.state = "unavailable";
        entry.error = undefined;
        evicted.push(entry.name);
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model stop failed";
      }
    }
    return evicted;
  }

  async drain() {
    for (const entry of this.entries.values()) {
      if (entry.refs !== 0 || entry.state !== "ready") continue;
      entry.state = "stopping";
      try {
        await entry.stop?.();
        entry.state = "unavailable";
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model stop failed";
      }
    }
  }

  snapshot() {
    return [...this.entries.values()].map(({ start, stop, ...entry }) => ({ ...entry }));
  }
}
