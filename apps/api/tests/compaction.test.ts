import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { compactLongContext } = await import("../src/services/chatEngine.js");
const { resetInventoryCache } = await import("../src/services/modelInventory.js");
const { resetHealth } = await import("../src/services/modelHealth.js");
const { resetProviderCache } = await import("../src/services/modelRouter.js");
const { quotaLimit, quotaPeriod, quotaMessage } = await import("../src/services/usageLimits.js");

/** A fake local Ollama with one model whose answers are counted. */
function fakeOllama() {
  const state = { summaries: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/api/version")) return Response.json({ version: "test" });
    if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: "small:1b" }] });
    if (url.endsWith("/api/show")) return Response.json({ capabilities: ["completion"], details: { parameter_size: "1B" }, model_info: { "x.context_length": 131072 } });
    if (url.endsWith("/api/ps")) return Response.json({ models: [] });
    if (url.endsWith("/api/chat")) { state.summaries += 1; return Response.json({ message: { content: `SUMMARY ${state.summaries}` }, done: true }); }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { state, restore: () => { globalThis.fetch = original; } };
}

const long = (count: number) => Array.from({ length: count }, (_, index) => ({ role: (index % 2 ? "assistant" : "user") as "user" | "assistant", content: `${index} ${"words ".repeat(400)}` }));

test("long chats are compacted, the summary is saved, reused, and refreshed only after several new messages", async () => {
  process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434"; process.env.BOBAI_MODEL_ROUTING_LOG = "false";
  resetInventoryCache(); resetHealth(); resetProviderCache();
  const ollama = fakeOllama();
  let saved: { summary: string; covered: number; hash: string } | undefined;
  const cache = { load: async () => saved, save: async (value: typeof saved) => { saved = value; } };
  try {
    const first = await compactLongContext(long(20), undefined, undefined, cache);
    assert.equal(first.compacted, 12, "everything except the newest 8 messages is summarized");
    assert.match(first.messages[0].content, /SUMMARY 1/);
    assert.equal(first.messages.length, 9);
    assert.equal(ollama.state.summaries, 1);

    const next = await compactLongContext(long(22), undefined, undefined, cache);
    assert.equal(ollama.state.summaries, 1, "two new messages reuse the saved summary");
    assert.match(next.messages[0].content, /SUMMARY 1/);
    assert.match(next.messages.at(-1)!.content, /^21 /, "the newest message is always kept word for word");

    await compactLongContext(long(28), undefined, undefined, cache);
    assert.equal(ollama.state.summaries, 2, "after several new messages the summary is extended");
    assert.equal(saved!.covered, 20);

    const edited = long(28); edited[0] = { role: "user", content: "a completely different start" + " x".repeat(400) };
    await compactLongContext(edited, undefined, undefined, cache);
    assert.equal(ollama.state.summaries, 3, "if earlier messages changed, the summary is rebuilt");

    const short = await compactLongContext(long(4), undefined, undefined, cache);
    assert.equal(short.compacted, 0, "short chats are left alone");
  } finally {
    ollama.restore(); delete process.env.BOBAI_OLLAMA_BASE_URL; delete process.env.BOBAI_MODEL_ROUTING_LOG;
  }
});

test("compacting can be turned off", async () => {
  process.env.BOBAI_CONTEXT_COMPACTION = "false";
  try { assert.equal((await compactLongContext(long(30))).compacted, 0); } finally { delete process.env.BOBAI_CONTEXT_COMPACTION; }
});

test("usage limits default below each free tier and can be changed or switched off", () => {
  assert.equal(quotaLimit("chat_user"), 60);
  assert.equal(quotaLimit("cricket_feed"), 95);
  assert.equal(quotaLimit("brave_search"), 900);
  process.env.BOBAI_LIMIT_CHAT_PER_USER_PER_DAY = "0";
  process.env.BOBAI_LIMIT_CRICKET_CALLS_PER_DAY = "nonsense";
  try {
    assert.equal(quotaLimit("chat_user"), 0, "0 means unlimited");
    assert.equal(quotaLimit("cricket_feed"), 95, "bad values fall back to the default");
  } finally { delete process.env.BOBAI_LIMIT_CHAT_PER_USER_PER_DAY; delete process.env.BOBAI_LIMIT_CRICKET_CALLS_PER_DAY; }
  const day = quotaPeriod("chat_user", new Date("2026-10-23T18:30:00Z"));
  assert.equal(day.label, "2026-10-23");
  assert.equal(day.endsAt.toISOString(), "2026-10-24T00:00:00.000Z");
  assert.equal(quotaPeriod("brave_search", new Date("2026-10-23T18:30:00Z")).endsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.match(quotaMessage({ name: "chat_user", used: 61, limit: 60, allowed: false, resetsAt: day.endsAt.toISOString() }), /all 60 of today's messages/);
});
