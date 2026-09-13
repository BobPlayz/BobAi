import assert from "node:assert/strict";
import test from "node:test";
import { buildToolDecisionMessages, validateToolDecision } from "../src/services/toolDecision.js";

test("tool decisions fail closed on malformed model output", () => {
  assert.deepEqual(validateToolDecision(undefined), { action: "respond", calls: [], reason: "invalid router output" });
  assert.deepEqual(validateToolDecision({ action: "use_tools", calls: [{ tool: "not-real", arguments: {} }] }), { action: "respond", calls: [], reason: "unknown or disabled tool: not-real" });
});

test("tool decisions reject malformed arguments", () => {
  const decision = validateToolDecision({ action: "use_tools", calls: [{ tool: "browser", arguments: {} }] });
  assert.equal(decision.action, "respond");
  assert.match(decision.reason || "", /missing required argument/);
});

test("router prompt exposes registered tools without granting permissions", () => {
  const messages = buildToolDecisionMessages([{ role: "user", content: "search the web for BobAI" }]);
  assert.match(messages[0].content, /AVAILABLE TOOLS:/);
  assert.match(messages[0].content, /research:/);
  assert.match(messages[0].content, /requests only/);
});
