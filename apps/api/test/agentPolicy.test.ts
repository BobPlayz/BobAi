import { describe, expect, it } from "vitest";
import { nextReadySteps, normalizeBudget, validateAgentPlan } from "../src/services/agentOrchestration.js";
import { assertMediaPromptSafe } from "../src/services/mediaSafety.js";

describe("agent orchestration", () => {
  it("rejects dependency cycles and clamps budgets", () => {
    expect(() => validateAgentPlan([{ id: "a", description: "a", dependsOn: ["b"] }, { id: "b", description: "b", dependsOn: ["a"] }])).toThrow(/cycle/i);
    expect(normalizeBudget({ maxSteps: 999, maxTokens: 9999999, maxDurationMs: 999999999, minConfidence: 999 })).toEqual({ maxSteps: 50, maxTokens: 500000, maxDurationMs: 7200000, minConfidence: 100 });
  });
  it("returns only dependency-ready work", () => {
    const plan = validateAgentPlan([{ id: "a", description: "a" }, { id: "b", description: "b", dependsOn: ["a"] }]);
    expect(nextReadySteps({ id: "p", ...plan }, new Set()).map((step) => step.id)).toEqual(["a"]);
    expect(nextReadySteps({ id: "p", ...plan }, new Set(["a"])).map((step) => step.id)).toEqual(["b"]);
  });
});

describe("media safety", () => {
  it("blocks sexual content involving minors and graphic violence", () => {
    expect(() => assertMediaPromptSafe("sexual content involving a minor")).toThrow();
    expect(() => assertMediaPromptSafe("graphic gore and dismemberment")).toThrow();
    expect(assertMediaPromptSafe("a landscape with mountains at sunset")).toBe(true);
  });
});
