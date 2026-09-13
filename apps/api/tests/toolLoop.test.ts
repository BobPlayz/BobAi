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
  );
  assert.equal(result.status, "completed");
  assert.equal(result.toolCalls, 1);
  assert.deepEqual(result.usedTools, ["research"]);
  assert.equal(seen.length, 2);
  assert.match(seen[1].at(-1) || "", /untrusted tool result/);
});

test("approval-required tools stop before execution", async () => {
  const result = await runToolLoop(
    [{ role: "user", content: "open a site" }],
    { userId: "u", workspaceId: "w", maxRounds: 2 },
    async () => ({ action: "use_tools", calls: [{ tool: "browser", arguments: { url: "https://example.com" } }] }),
    async () => ({ content: "should not run" }),
  );
  assert.equal(result.status, "approval_required");
  assert.deepEqual(result.usedTools, ["browser"]);
  assert.equal(result.toolCalls, 0);
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
  const decision = validateToolDecision({ action: "use_tools", calls: [
    { tool: "browser", arguments: { url: "https://example.com" } },
    { tool: "website-test", arguments: { url: "https://example.com" } },
  ] });
  assert.equal(decision.action, "respond");
  assert.match(decision.reason || "", /multiple approval-required/);
});
