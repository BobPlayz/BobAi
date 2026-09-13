import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableJobQueue } from "../src/durableQueue.js";
import { ModelLifecycleManager } from "../src/modelLifecycle.js";
import { inspectArtifact } from "../src/modelArtifact.js";
import { planRollingDeployment } from "../src/rollingDeployment.js";
import { InMemorySharedState } from "../src/sharedState.js";
import { BoundedEventBuffer, canAccept } from "../src/runtimePolicy.js";

async function tempFile(name: string) {
  const dir = await mkdtemp(join(tmpdir(), "bobhs-test-"));
  return { dir, file: join(dir, name) };
}

test("durable queue deduplicates concurrent idempotency keys across instances", async () => {
  const { dir, file } = await tempFile("queue.json");
  try {
    const a = new DurableJobQueue({ stateFile: file });
    const b = new DurableJobQueue({ stateFile: file });
    await Promise.all([a.load(), b.load()]);
    const [first, second] = await Promise.all([
      a.enqueue("deploy", { image: "bob" }, { idempotencyKey: "same" }),
      b.enqueue("deploy", { image: "bob" }, { idempotencyKey: "same" }),
    ]);
    assert.equal(first.id, second.id);
    const jobs = await a.list();
    assert.equal(jobs.length, 1);
    const claimedA = await a.claim("worker-a");
    const claimedB = await b.claim("worker-b");
    assert.ok(claimedA);
    assert.equal(claimedB, undefined);
    assert.equal(await a.succeed(claimedA!.id, "worker-a", { ok: true }), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("model lifecycle shares one startup between concurrent acquires", async () => {
  const manager = new ModelLifecycleManager();
  let starts = 0;
  let releaseStart!: () => void;
  const startGate = new Promise<void>(resolve => { releaseStart = resolve; });
  manager.register("bob", { start: async () => { starts++; await startGate; } });
  const one = manager.acquire("bob");
  const two = manager.acquire("bob");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1);
  releaseStart();
  await Promise.all([one, two]);
  assert.equal(manager.snapshot()[0].refs, 2);
  manager.release("bob");
  manager.release("bob");
  assert.equal(manager.snapshot()[0].refs, 0);
});

test("shared state enforces optimistic version checks", async () => {
  const state = new InMemorySharedState();
  const first = await state.write("deployment", { replicas: 1 });
  assert.equal(first.version, 1);
  const second = await state.write("deployment", { replicas: 2 }, 1);
  assert.equal(second.version, 2);
  await assert.rejects(() => state.write("deployment", { replicas: 3 }, 1), /version conflict/);
});

test("artifact inspection detects both size and digest mismatches", async () => {
  const { dir, file } = await tempFile("model.bob");
  try {
    const data = Buffer.from("bob-model");
    await writeFile(file, data);
    const crypto = await import("node:crypto");
    const sha256 = crypto.createHash("sha256").update(data).digest("hex");
    assert.equal((await inspectArtifact(file, { name: "bob", version: "1", sha256, bytes: data.length, format: "bobai-native-transformer" })).ok, true);
    assert.equal((await inspectArtifact(file, { name: "bob", version: "1", sha256: "0".repeat(64), bytes: data.length, format: "bobai-native-transformer" })).ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rolling deployment planner preserves at least the target replica count", () => {
  const scaleDown = planRollingDeployment({ currentReplicas: 5, targetReplicas: 2, maxUnavailable: 1, maxSurge: 1 });
  const stopped = scaleDown.filter(step => step.action === "stop").reduce((sum, step) => sum + step.count, 0);
  assert.equal(stopped, 3);
  const scaleUp = planRollingDeployment({ currentReplicas: 2, targetReplicas: 5, maxUnavailable: 0, maxSurge: 2 });
  const started = scaleUp.filter(step => step.action === "start").reduce((sum, step) => sum + step.count, 0);
  assert.equal(started, 3);
});

test("runtime policy rejects new work while draining and bounds events", () => {
  assert.equal(canAccept({ queueDepth: 0, running: 0, maxRunning: 2, draining: true }, "critical"), false);
  const buffer = new BoundedEventBuffer(2);
  buffer.push({ at: "1", type: "one" });
  buffer.push({ at: "2", type: "two" });
  buffer.push({ at: "3", type: "three" });
  assert.deepEqual(buffer.list().map(event => event.type), ["two", "three"]);
});
