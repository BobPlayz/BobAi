import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicTargetUrl, providerUrl, targetUrl } from "../src/services/httpSafety.js";
import { runToolLoop, serializeToolResult } from "../src/services/toolLoop.js";
import { validateToolDecision } from "../src/services/toolDecision.js";

test("tool loop feeds results back to the same decision model", async () => {
  const seen: string[][] = [];
  let decisions = 0;
  const result = await runToolLoop(
    [{ role: "system", content: "system" }, { role: "user", content: "research this" }],
    { userId: "u", workspaceId: "w", maxRounds: 3 },
    async (messages) => {
      seen.push(messages.map((message) => message.content));
      decisions += 1;
      if (decisions === 1) return { action: "use_tools", calls: [{ tool: "research", arguments: { query: "test" } }] };
      return { action: "respond", calls: [] };
    },
    async (messages) => ({ content: messages.at(-1)?.content || "done" }),
    async (toolId) => ({ toolId, value: "ok" }),
  );
  assert.equal(result.status, "completed");
  assert.equal(result.toolCalls, 1);
  assert.deepEqual(result.usedTools, ["research"]);
  assert.equal(seen.length, 2);
  assert.match(seen[1].at(-1) || "", /untrusted tool result/);
});

test("approval-required tools stop before execution", async () => {
  let executed = false;
  const result = await runToolLoop(
    [{ role: "user", content: "open a site" }],
    { userId: "u", workspaceId: "w", maxRounds: 2 },
    async () => ({ action: "use_tools", calls: [{ tool: "browser", arguments: { url: "https://example.com" } }] }),
    async () => ({ content: "should not run" }),
    async () => { executed = true; return {}; },
  );
  assert.equal(result.status, "approval_required");
  assert.deepEqual(result.usedTools, ["browser"]);
  assert.equal(result.toolCalls, 0);
  assert.equal(executed, false);
});

test("tool results are bounded and serialization is safe", () => {
  const text = serializeToolResult({ value: "x".repeat(100_000) });
  assert.equal(text.length, 20_000);
  assert.doesNotThrow(() => serializeToolResult(undefined));
});

test("target URLs reject embedded credentials and private addresses", async () => {
  assert.throws(() => targetUrl("https://user:pass@example.com"), /credentials/);
  assert.throws(() => targetUrl("file:///etc/passwd"), /protocol/);
  await assert.rejects(() => assertPublicTargetUrl("http://127.0.0.1:3000"), /private/);
  await assert.rejects(() => assertPublicTargetUrl("http://localhost:3000"), /private/);
});

test("provider URLs only permit HTTPS except local development loopback", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(() => providerUrl("http://127.0.0.1:3456"), /HTTPS/);
    assert.doesNotThrow(() => providerUrl("https://example.com"));
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("tool routing fails closed when tools are globally disabled", () => {
  const previous = process.env.BOBAI_TOOLS_ENABLED;
  try {
    process.env.BOBAI_TOOLS_ENABLED = "false";
    assert.deepEqual(validateToolDecision({ action: "use_tools", calls: [{ tool: "research", arguments: { query: "x" } }] }), { action: "respond", calls: [], reason: "tools are disabled" });
  } finally {
    if (previous === undefined) delete process.env.BOBAI_TOOLS_ENABLED;
    else process.env.BOBAI_TOOLS_ENABLED = previous;
  }
});

test("tool routing does not bundle multiple approval-required actions", () => {
  process.env.BOBAI_BROWSER_PROVIDER_URL = "https://browser.example.test";
  try {
    const decision = validateToolDecision({ action: "use_tools", calls: [
      { tool: "browser", arguments: { url: "https://example.com" } },
      { tool: "website-test", arguments: { url: "https://example.com" } },
    ] });
    assert.equal(decision.action, "respond");
    assert.match(decision.reason || "", /multiple approval-required/);
  } finally { delete process.env.BOBAI_BROWSER_PROVIDER_URL; }
});

test("tool loop forwards the request abort signal to the model-based router", async () => {
  const controller = new AbortController();
  let receivedSignal: AbortSignal | undefined;
  const result = await runToolLoop(
    [{ role: "user", content: "answer this" }],
    { userId: "u", workspaceId: "w", signal: controller.signal },
    async (_messages, _modelId, signal) => {
      receivedSignal = signal;
      return { action: "respond", calls: [] };
    },
    async () => ({ content: "done" }),
    async () => ({}),
  );
  assert.equal(receivedSignal, controller.signal);
  assert.equal(result.status, "completed");
});


test("tool loop returns a deterministic clarification without calling the answer model", async () => {
  let answered = false;
  const result = await runToolLoop(
    [{ role: "user", content: "run browser agent" }],
    { userId: "u", workspaceId: "w" },
    async () => ({ action: "clarify", calls: [], message: "Send the full URL first." }),
    async () => { answered = true; return { content: "I checked your user agent." }; },
    async () => ({ status: "unexpected" }),
  );
  assert.equal(result.status, "completed");
  assert.equal(result.message, "Send the full URL first.");
  assert.equal(answered, false);
});

test("tool loop fails closed when an executor throws instead of asking the model to narrate success", async () => {
  let decisions = 0;
  let answered = false;
  const result = await runToolLoop(
    [{ role: "user", content: "research this" }],
    { userId: "u", workspaceId: "w", maxRounds: 3 },
    async () => { decisions += 1; return { action: "use_tools", calls: [{ tool: "research", arguments: { query: "test" } }] }; },
    async () => { answered = true; return { content: "It succeeded." }; },
    async () => { throw new Error("provider unavailable"); },
  );
  assert.equal(result.status, "failed");
  assert.match(result.message, /No successful result was confirmed/i);
  assert.equal(decisions, 1);
  assert.equal(answered, false);
});

test("tool loop treats explicit unavailable results as failures", async () => {
  const result = await runToolLoop(
    [{ role: "user", content: "run a tool" }],
    { userId: "u", workspaceId: "w" },
    async () => ({ action: "use_tools", calls: [{ tool: "research", arguments: { query: "test" } }] }),
    async () => ({ content: "It succeeded." }),
    async () => ({ status: "unavailable", reason: "not configured" }),
  );
  assert.equal(result.status, "failed");
  assert.match(result.message, /did not return a verified successful result/i);
});


test("tool loop fails closed when the router returns an invalid decision", async () => {
  let answered = false;
  const result = await runToolLoop(
    [{ role: "user", content: "research this" }],
    { userId: "u", workspaceId: "w" },
    async () => ({ action: "respond", calls: [], reason: "invalid router output" }),
    async () => { answered = true; return { content: "I researched it successfully." }; },
    async () => ({ value: "unused" }),
  );
  assert.equal(result.status, "failed");
  assert.match(result.message, /couldn’t safely complete/i);
  assert.equal(answered, false);
});


test("invalid tool routing gives a user-safe message without exposing internal diagnostics", async () => {
  const result = await runToolLoop(
    [{ role: "user", content: "run the requested action" }],
    { userId: "u", workspaceId: "w" },
    async () => ({ action: "respond", calls: [], reason: "unknown or disabled tool: private-provider-name" }),
    async () => ({ content: "This should not run." }),
    async () => ({ value: "unused" }),
  );
  assert.equal(result.status, "failed");
  assert.match(result.message, /couldn’t safely complete/i);
  assert.doesNotMatch(result.message, /private-provider-name|routing|configuration|stack|error/i);
});
