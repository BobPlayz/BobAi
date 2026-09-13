import test from "node:test";
import assert from "node:assert/strict";
import { planRollingDeployment } from "../src/rollingDeployment.js";

test("rollout planner rejects impossible zero-budget changes", () => {
  assert.throws(() => planRollingDeployment({ currentReplicas: 2, targetReplicas: 3, maxUnavailable: 0, maxSurge: 0 }), /maxSurge/);
  assert.throws(() => planRollingDeployment({ currentReplicas: 3, targetReplicas: 2, maxUnavailable: 0, maxSurge: 1 }), /maxUnavailable/);
});
