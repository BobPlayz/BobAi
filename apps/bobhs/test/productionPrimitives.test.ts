import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSharedState } from "../src/fileSharedState.js";
import { createModelBundleManifest, validateModelBundleManifest } from "../src/modelBundle.js";
import { RuntimeMetrics } from "../src/runtimeMetrics.js";

test("file shared state persists and rejects stale writers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bobhs-state-"));
  try {
    const path = join(dir, "state.json");
    const a = new FileSharedState(path); const b = new FileSharedState(path);
    const first = await a.write("job", { status: "queued" });
    const second = await b.write("job", { status: "running" }, first.version);
    assert.equal(second.version, 2);
    await assert.rejects(() => a.write("job", { status: "failed" }, first.version), /version conflict/);
    assert.deepEqual((await a.read<{ status: string }>("job"))?.value, { status: "running" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("model bundle manifest is deterministic and validates safe metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bobhs-bundle-"));
  try {
    const file = join(dir, "weights.bin"); await writeFile(file, Buffer.from("weights"));
    const manifest = await createModelBundleManifest("bob", "0.2", [file]);
    validateModelBundleManifest(manifest); assert.equal(manifest.files.length, 1);
    assert.throws(() => validateModelBundleManifest({ ...manifest, files: [{ ...manifest.files[0], path: "../secret" }] }), /invalid model bundle/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("runtime metrics expose bounded operational counters", () => {
  const metrics = new RuntimeMetrics(); metrics.accept(); metrics.complete(40); metrics.fail(); metrics.retry();
  const snapshot = metrics.snapshot(); assert.equal(snapshot.accepted, 1); assert.equal(snapshot.completed, 1); assert.equal(snapshot.failed, 1); assert.equal(snapshot.retried, 1); assert.equal(snapshot.averageLatencyMs, 40);
});
