import assert from "node:assert/strict";
import test from "node:test";
import { buildToolDecisionMessages, validateToolDecision } from "../src/services/toolDecision.js";

test("tool decisions fail closed on malformed model output", () => {
  assert.deepEqual(validateToolDecision(undefined), { action: "respond", calls: [], reason: "invalid router output" });
  assert.deepEqual(validateToolDecision({ action: "use_tools", calls: [{ tool: "not-real", arguments: {} }] }), { action: "respond", calls: [], reason: "unknown or disabled tool: not-real" });
});

test("tool decisions reject malformed arguments", () => {
  process.env.BOBAI_BROWSER_PROVIDER_URL = "https://browser.example.test";
  try {
    const decision = validateToolDecision({ action: "use_tools", calls: [{ tool: "browser", arguments: {} }] });
    assert.equal(decision.action, "respond");
    assert.match(decision.reason || "", /missing required argument/);
  } finally { delete process.env.BOBAI_BROWSER_PROVIDER_URL; }
});

test("tools without a configured provider are hidden from the router and rejected", () => {
  delete process.env.BOBAI_COMPUTER_PROVIDER_URL;
  const decision = validateToolDecision({ action: "use_tools", calls: [{ tool: "paint", arguments: { prompt: "a cat" } }] });
  assert.equal(decision.action, "respond");
  assert.match(decision.reason || "", /unknown or disabled tool/);
  const messages = buildToolDecisionMessages([{ role: "user", content: "draw a cat in paint" }]);
  assert.doesNotMatch(messages[0].content, /\npaint:/);
});

test("router prompt exposes registered tools without granting permissions", () => {
  const messages = buildToolDecisionMessages([{ role: "user", content: "search the web for BobAI" }]);
  assert.match(messages[0].content, /AVAILABLE TOOLS:/);
  assert.match(messages[0].content, /research:/);
  assert.match(messages[0].content, /requests only/);
});

test("live weather and cricket tools are selectable with validated arguments", () => {
  assert.equal(validateToolDecision({ action: "use_tools", calls: [{ tool: "weather", arguments: { city: "Delhi" } }] }).action, "use_tools");
  assert.equal(validateToolDecision({ action: "use_tools", calls: [{ tool: "cricket", arguments: { query: "latest international cricket match score" } }] }).action, "use_tools");
  assert.equal(validateToolDecision({ action: "use_tools", calls: [{ tool: "weather", arguments: {} }] }).action, "respond");
});
