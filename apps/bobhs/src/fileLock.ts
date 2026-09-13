import { mkdir, rm } from "node:fs/promises";

export async function withFileLock<T>(lockPath: string, work: () => Promise<T>, timeoutMs = 10_000) {
  const timeout = Math.max(100, timeoutMs);
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      try {
        return await work();
      } finally {
        await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code !== "EEXIST") throw error;
      if (Date.now() - started >= timeout) throw new Error(`timed out acquiring lock: ${lockPath}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}
