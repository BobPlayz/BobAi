export type ModelState = "unavailable" | "starting" | "ready" | "stopping" | "error";

type Entry = {
  name: string;
  state: ModelState;
  refs: number;
  lastUsedAt: number;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  error?: string;
  startPromise?: Promise<void>;
  stopPromise?: Promise<void>;
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
    if (entry.state === "stopping") {
      if (entry.stopPromise) await entry.stopPromise;
      if (entry.state !== "unavailable") throw new Error(`model ${name} is stopping`);
    }
    if (entry.state === "unavailable") {
      entry.state = "starting";
      const start = entry.start?.() ?? Promise.resolve();
      entry.startPromise = start;
      try {
        await start;
        entry.state = "ready";
        entry.error = undefined;
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model start failed";
        throw error;
      } finally {
        entry.startPromise = undefined;
      }
    } else if (entry.state === "starting") {
      if (entry.startPromise) await entry.startPromise;
      if (entry.state !== "ready") throw new Error(entry.error || `model ${name} failed to start`);
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

  recover(name: string) {
    const entry = this.entries.get(name);
    if (!entry) return false;
    if (entry.state !== "error" || entry.refs !== 0) return false;
    entry.state = "unavailable";
    entry.error = undefined;
    return true;
  }

  async evictIdle(maxIdleMs: number, now = Date.now()) {
    const evicted: string[] = [];
    for (const entry of this.entries.values()) {
      if (entry.state !== "ready" || entry.refs !== 0 || now - entry.lastUsedAt < maxIdleMs) continue;
      entry.state = "stopping";
      const stop = entry.stop?.() ?? Promise.resolve();
      entry.stopPromise = stop;
      try {
        await stop;
        entry.state = "unavailable";
        entry.error = undefined;
        evicted.push(entry.name);
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model stop failed";
      } finally {
        entry.stopPromise = undefined;
      }
    }
    return evicted;
  }

  async drain() {
    for (const entry of this.entries.values()) {
      if (entry.refs !== 0 || entry.state !== "ready") continue;
      entry.state = "stopping";
      const stop = entry.stop?.() ?? Promise.resolve();
      entry.stopPromise = stop;
      try {
        await stop;
        entry.state = "unavailable";
        entry.error = undefined;
      } catch (error) {
        entry.state = "error";
        entry.error = error instanceof Error ? error.message : "model stop failed";
      } finally {
        entry.stopPromise = undefined;
      }
    }
  }

  snapshot() {
    return [...this.entries.values()].map(({ start, stop, startPromise, stopPromise, ...entry }) => ({ ...entry }));
  }
}
