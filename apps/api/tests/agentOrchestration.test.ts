import { describe, expect, it } from "vitest";
import { normalizeBudget, validateAgentPlan } from "../src/services/agentOrchestration.js";

describe("agent orchestration validation", () => {
  it("uses safe defaults for invalid budget numbers", () => {
    expect(normalizeBudget({ maxSteps: Number.POSITIVE_INFINITY, maxTokens: Number.NaN })).toEqual({ maxSteps: 20, maxTokens: 100000, maxDurationMs: 1800000, minConfidence: 70 });
  });
  it("rejects non-pending caller status", () => {
    expect(() => validateAgentPlan([{ id: "step", description: "process", status: "completed" }])).toThrow(/execution status/);
  });
  it("rejects invalid estimates", () => {
    expect(() => validateAgentPlan([{ id: "step", description: "process", estimatedTokens: Number.NaN }])).toThrow(/token estimate/);
    expect(() => validateAgentPlan([{ id: "step", description: "process", estimatedMs: Number.POSITIVE_INFINITY }])).toThrow(/duration estimate/);
  });
  it("rejects an estimated duration above the budget", () => {
    expect(() => validateAgentPlan([{ id: "step", description: "process", estimatedMs: 1860000 }])).toThrow(/duration budget/);
  });
});
