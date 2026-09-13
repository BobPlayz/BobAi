import test from "node:test";
import assert from "node:assert/strict";
import { runToolLoop, serializeToolResult } from "../src/services/toolLoop.js";
import { targetUrl, providerUrl } from "../src/services/httpSafety.js";

test("tool loop feeds results back to the same decision model", async () => {
  const seen: string[][] = []; let decisions = 0;
  const result = await runToolLoop([{ role: "system", content: "system" }, { role: "user", content: "research this" }], { userId: "u", workspaceId: "w", maxRounds: 3 }, async (messages) => { seen.push(messages.map((message) => message.content)); decisions += 1; if (decisions === 1) return { action: "use_tools", calls: [{ tool: "research", arguments: { query: "test" } }] }; return { action: "respond", calls: [] }; }, async (messages) => ({ content: messages.at(-1)?.content || "done" }));
  assert.equal(result.status, "completed"); assert.equal(result.toolCalls, 1); assert.deepEqual(result.usedTools, ["research"]); assert.equal(seen.length, 2); assert.match(seen[1].at(-1) || "", /untrusted tool result/);
});

test("approval-required tools stop before execution", async () => {
  const result = await runToolLoop([{ role: "user", content: "open a site" }], { userId: "u", workspaceId: "w", maxRounds: 2 }, async () => ({ action: "use_tools", calls: [{ tool: "browser", arguments: { url: "https://example.com" } }] }), async () => ({ content: "should not run" }));
  assert.equal(result.status, "approval_required"); assert.deepEqual(result.usedTools, ["browser"]); assert.equal(result.toolCalls, 0);
});

test("tool results are bounded and serialization is safe", () => { const text = serializeToolResult({ value: "x".repeat(100_000) }); assert.equal(text.length, 20_000); assert.doesNotThrow(() => serializeToolResult(undefined)); });

test("provider and target URL guards reject unsafe schemes", () => { const previous = process.env.NODE_ENV; process.env.NODE_ENV = "production"; assert.throws(() => providerUrl("http://provider.example")); assert.throws(() => targetUrl("http://example.com")); process.env.NODE_ENV = previous; assert.equal(providerUrl("http://127.0.0.1:3001").hostname, "127.0.0.1"); assert.throws(() => targetUrl("https://user:pass@example.com")); assert.equal(targetUrl("https://example.com").hostname, "example.com"); });
