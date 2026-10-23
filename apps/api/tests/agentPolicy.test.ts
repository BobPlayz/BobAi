import assert from "node:assert/strict";
import test from "node:test";
import { nextReadySteps, normalizeBudget, validateAgentPlan } from "../src/services/agentOrchestration.js";
import { assertMediaPromptSafe } from "../src/services/mediaSafety.js";

test("agent plans reject dependency cycles and clamp budgets", () => {
  assert.throws(() => validateAgentPlan([{ id: "a", description: "a", dependsOn: ["b"] }, { id: "b", description: "b", dependsOn: ["a"] }]), /cycle/i);
  assert.deepEqual(normalizeBudget({ maxSteps: 999, maxTokens: 9999999, maxDurationMs: 999999999, minConfidence: 999 }), { maxSteps: 50, maxTokens: 500000, maxDurationMs: 7200000, minConfidence: 100 });
});

test("agent plans return only dependency-ready work", () => {
  const plan = validateAgentPlan([{ id: "a", description: "a" }, { id: "b", description: "b", dependsOn: ["a"] }]);
  assert.deepEqual(nextReadySteps({ id: "p", ...plan }, new Set()).map((step) => step.id), ["a"]);
  assert.deepEqual(nextReadySteps({ id: "p", ...plan }, new Set(["a"])).map((step) => step.id), ["b"]);
});

test("media prompts with sexual content involving minors or graphic violence are blocked", () => {
  assert.throws(() => assertMediaPromptSafe("sexual content involving a minor"));
  assert.throws(() => assertMediaPromptSafe("graphic gore and dismemberment"));
  assert.equal(assertMediaPromptSafe("a landscape with mountains at sunset"), true);
});
