import test from "node:test";
import assert from "node:assert/strict";
import { chooseNode, nodeCanRun, scoreNode, type SchedulerDeployment, type SchedulerNode } from "../src/scheduler.js";

const base: SchedulerDeployment = { memoryMb: 512, replicas: 1, cpus: 0.5, requiredLabels: [], requiredCapabilities: ["chat"] };
const healthy: SchedulerNode = { id: "a", status: "online", cpuCount: 8, memoryMb: 8192, freeMemoryMb: 6144, load1: 0.5, activeJobs: 1, labels: ["laptop"], capabilities: ["chat"] };

test("scheduler rejects offline and incapable nodes", () => {
  assert.equal(nodeCanRun({ ...healthy, status: "offline" }, base), false);
  assert.equal(nodeCanRun({ ...healthy, capabilities: [] }, base), false);
  assert.equal(nodeCanRun({ ...healthy, freeMemoryMb: 512 }, base), false);
});

test("scheduler prefers a requested node", () => {
  const preferred = { ...base, preferredNodeId: "b" };
  const other = { ...healthy, id: "b", load1: 3 };
  assert.ok(scoreNode(other, preferred) > scoreNode(healthy, preferred));
  assert.equal(chooseNode([healthy, other], preferred)?.id, "b");
});
