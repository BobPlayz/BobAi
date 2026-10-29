import assert from "node:assert/strict";
import test from "node:test";
import { buildToolDecisionMessages, explicitBrowserAgentDecision, validateToolDecision } from "../src/services/toolDecision.js";

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


test("explicit browser-agent requests ask for a URL instead of answering an unrelated browser question", () => {
  const decision = explicitBrowserAgentDecision([{ role: "user", content: "run browser agent" }]);
  assert.equal(decision?.action, "clarify");
  assert.match(decision?.message || "", /full URL/i);
  assert.match(decision?.message || "", /No browser action has been run/i);
});

test("explicit browser-agent requests report missing provider configuration honestly", () => {
  const previous = process.env.BOBAI_BROWSER_PROVIDER_URL;
  delete process.env.BOBAI_BROWSER_PROVIDER_URL;
  try {
    const decision = explicitBrowserAgentDecision([{ role: "user", content: "run browser agent on https://example.com" }]);
    assert.equal(decision?.action, "clarify");
    assert.match(decision?.message || "", /not configured/i);
    assert.match(decision?.message || "", /No browser action was performed/i);
  } finally {
    if (previous === undefined) delete process.env.BOBAI_BROWSER_PROVIDER_URL;
    else process.env.BOBAI_BROWSER_PROVIDER_URL = previous;
  }
});

test("explicit browser-agent requests select the real browser tool when configured", () => {
  const previous = process.env.BOBAI_BROWSER_PROVIDER_URL;
  process.env.BOBAI_BROWSER_PROVIDER_URL = "https://browser.example.test";
  try {
    const decision = explicitBrowserAgentDecision([{ role: "user", content: "run browser agent on https://example.com" }]);
    assert.equal(decision?.action, "use_tools");
    assert.deepEqual(decision?.calls, [{ tool: "browser", arguments: { url: "https://example.com" } }]);
  } finally {
    if (previous === undefined) delete process.env.BOBAI_BROWSER_PROVIDER_URL;
    else process.env.BOBAI_BROWSER_PROVIDER_URL = previous;
  }
});


test("opening a URL directly routes to the browser agent", () => {
  const previous = process.env.BOBAI_BROWSER_PROVIDER_URL;
  process.env.BOBAI_BROWSER_PROVIDER_URL = "https://browser.example.test";
  try {
    const decision = explicitBrowserAgentDecision([{ role: "user", content: "open [https://jarvis-x-ai-two.vercel.app](https://jarvis-x-ai-two.vercel.app)" }]);
    assert.equal(decision?.action, "use_tools");
    assert.deepEqual(decision?.calls, [{ tool: "browser", arguments: { url: "https://jarvis-x-ai-two.vercel.app" } }]);
  } finally {
    if (previous === undefined) delete process.env.BOBAI_BROWSER_PROVIDER_URL;
    else process.env.BOBAI_BROWSER_PROVIDER_URL = previous;
  }
});

test("opening Jarvis reuses a URL supplied in the previous user message", () => {
  const previous = process.env.BOBAI_BROWSER_PROVIDER_URL;
  process.env.BOBAI_BROWSER_PROVIDER_URL = "https://browser.example.test";
  try {
    const decision = explicitBrowserAgentDecision([
      { role: "user", content: "Use the browser agent on https://jarvis-x-ai-two.vercel.app" },
      { role: "assistant", content: "Which page do you want me to open?" },
      { role: "user", content: "open Jarvis" },
    ]);
    assert.equal(decision?.action, "use_tools");
    assert.deepEqual(decision?.calls, [{ tool: "browser", arguments: { url: "https://jarvis-x-ai-two.vercel.app" } }]);
  } finally {
    if (previous === undefined) delete process.env.BOBAI_BROWSER_PROVIDER_URL;
    else process.env.BOBAI_BROWSER_PROVIDER_URL = previous;
  }
});

test("explicit browser routing does not repeat after a browser tool was requested", () => {
  const decision = explicitBrowserAgentDecision([
    { role: "user", content: "run browser agent on https://example.com" },
    { role: "assistant", content: "[bob requested tool: browser]" },
    { role: "user", content: "[untrusted tool result for browser] {} [/untrusted tool result]" },
  ]);
  assert.equal(decision, null);
});
