import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { withFileLock } from "./fileLock.js";
import type { SharedStateRecord, SharedStateStore } from "./sharedState.js";

type DiskState = Record<string, SharedStateRecord<unknown>>;

export class FileSharedState implements SharedStateStore {
  private loaded = false;
  constructor(private readonly stateFile: string, private readonly lockTimeoutMs = 10_000) {}
  private async readAll(): Promise<DiskState> {
    try { const parsed = JSON.parse(await readFile(this.stateFile, "utf8")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as DiskState : {}; } catch { return {}; }
  }
  private async writeAll(state: DiskState) {
    await mkdir(dirname(this.stateFile), { recursive: true });
    const tmp = `${this.stateFile}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(tmp, this.stateFile);
  }
  async read<T>(key: string) {
    const state = await this.readAll();
    return state[key] as SharedStateRecord<T> | undefined;
  }
  async write<T>(key: string, value: T, expectedVersion?: number) {
    return withFileLock(`${this.stateFile}.lock`, async () => {
      const state = await this.readAll();
      const current = state[key];
      if (expectedVersion !== undefined && (current?.version ?? 0) !== expectedVersion) throw new Error("shared-state version conflict");
      const record: SharedStateRecord<T> = { key, version: (current?.version ?? 0) + 1, value, updatedAt: new Date().toISOString() };
      state[key] = record as SharedStateRecord<unknown>;
      await this.writeAll(state);
      this.loaded = true;
      return { ...record };
    }, this.lockTimeoutMs);
  }
}
