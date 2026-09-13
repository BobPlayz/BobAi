import test from "node:test";
import assert from "node:assert/strict";

process.env["DATA" + "BASE" + "_URL"] ||= "postgres://127.0.0.1:1/bobai-test";
const { normalizeBudget, validateAgentPlan } = await import("../src/services/agentOrchestration.js");

test("agent orchestration validation uses safe defaults for invalid budget numbers", () => {
  assert.deepEqual(normalizeBudget({ maxSteps: Number.POSITIVE_INFINITY, maxTokens: Number.NaN }), { maxSteps: 20, maxTokens: 100000, maxDurationMs: 1800000, minConfidence: 70 });
});

test("agent orchestration rejects non-pending caller status", () => {
  assert.throws(() => validateAgentPlan([{ id: "step", description: "process", status: "completed" }]), /execution status/);
});

test("agent orchestration rejects invalid estimates", () => {
  assert.throws(() => validateAgentPlan([{ id: "step", description: "process", estimatedTokens: Number.NaN }]), /token estimate/);
  assert.throws(() => validateAgentPlan([{ id: "step", description: "process", estimatedMs: Number.POSITIVE_INFINITY }]), /duration estimate/);
});

test("agent orchestration rejects an estimated duration above the budget", () => {
  assert.throws(() => validateAgentPlan([{ id: "step", description: "process", estimatedMs: 1860000 }]), /duration budget/);
});
