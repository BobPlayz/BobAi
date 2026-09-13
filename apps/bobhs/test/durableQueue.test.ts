import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DurableJobQueue } from "../src/durableQueue.js";

test("durable queue rejects oversized payloads and results", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bobhs-queue-"));
  try {
    const queue = new DurableJobQueue({ stateFile: path.join(dir, "queue.json") });
    await queue.load();
    await assert.rejects(() => queue.enqueue("test", "x".repeat(256 * 1024 + 1)), /payload/);
    const job = await queue.enqueue("test", { ok: true });
    const claimed = await queue.claim("worker-1");
    assert.equal(claimed?.id, job.id);
    await assert.rejects(() => queue.succeed(job.id, "worker-1", "x".repeat(256 * 1024 + 1)), /result/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("durable queue rejects an oversized state file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bobhs-queue-"));
  try {
    const file = path.join(dir, "queue.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "x".repeat(16 * 1024 * 1024 + 1));
    const queue = new DurableJobQueue({ stateFile: file });
    await assert.rejects(() => queue.load(), /16 MB/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
