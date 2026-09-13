import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableJobQueue } from "../src/durableQueue.js";
import { ModelLifecycleManager } from "../src/modelLifecycle.js";
import { BobHSExecutionCoordinator } from "../src/executionCoordinator.js";

test("execution coordinator claims work, manages model refs, and records completion", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bobhs-coordinator-"));
  try {
    const queue = new DurableJobQueue({ stateFile: join(dir, "queue.json") });
    await queue.load();
    const models = new ModelLifecycleManager();
    let starts = 0; let stops = 0;
    models.register("bob", { start: async () => { starts++; }, stop: async () => { stops++; } });
    const coordinator = new BobHSExecutionCoordinator(queue, models);
    const job = await coordinator.enqueue("chat", { model: "bob", prompt: "hello" }, "chat-1");
    const result = await coordinator.runOnce("worker-a", async claimed => ({ jobId: claimed.id, ok: true }));
    assert.equal(result?.id, job.id);
    assert.equal(starts, 1);
    assert.equal(models.snapshot()[0].refs, 0);
    assert.equal((await queue.list())[0].status, "succeeded");
    assert.equal(coordinator.listEvents()[0].type, "execution-succeeded");
    await models.evictIdle(0, Date.now() + 1);
    assert.equal(stops, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
