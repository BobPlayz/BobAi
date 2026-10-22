import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { extractMemory } = await import("../src/utils/memoryExtractor.js");
const { detectLiveDataIntent, liveDataContext } = await import("../src/services/liveData.js");
const { contextCharacterBudget, prepareChat } = await import("../src/services/chatEngine.js");

test("only explicit memory commands are treated as memory saves", () => {
  for (const text of ["remember that I like tea", "Please remember my birthday is 3 May", "Jarvis, don't forget I'm vegetarian", "save to memory: my cat is Max", "note that the demo is on Friday"]) {
    assert.equal(extractMemory(text), true, text);
  }
  for (const text of ["I love Python, how do decorators work?", "Do you remember my name?", "my name is Bob", "save this file as pdf", "I hate this error: TypeError", "remember?", "I prefer short answers. Explain closures."]) {
    assert.equal(extractMemory(text), false, text);
  }
});

test("ordinary preference statements reach the model instead of the memory short-circuit", async () => {
  const prepared = await prepareChat({ messages: [{ role: "user", content: "I love Python, how do decorators work?" }] });
  assert.equal(prepared.memoryRequest, false);
});

test("weather and cricket questions are routed deterministically", () => {
  assert.deepEqual(detectLiveDataIntent("What's the weather in Hyderabad today?"), { kind: "weather", city: "Hyderabad" });
  assert.deepEqual(detectLiveDataIntent("forecast for New York"), { kind: "weather", city: "New York" });
  // No place named: never guess a location.
  assert.equal(detectLiveDataIntent("what's the weather like"), null);
  assert.equal(detectLiveDataIntent("India vs Australia live cricket score")?.kind, "cricket");
  assert.equal(detectLiveDataIntent("explain how rain forms"), null);
  assert.equal(detectLiveDataIntent("Explain how rain forms in clouds"), null);
  assert.deepEqual(detectLiveDataIntent("Will it rain in Mumbai tomorrow?"), { kind: "weather", city: "Mumbai" });
  assert.equal(detectLiveDataIntent("Explain the LBW rule in cricket"), null);
  assert.equal(detectLiveDataIntent("Who won the IPL final?")?.kind, "cricket");
  assert.equal(detectLiveDataIntent("write a python function"), null);
});

test("live data context tells the model the data source and forbids invented scores", () => {
  const text = liveDataContext({ kind: "cricket", provider: "DuckDuckGo", fetchedAt: "2026-10-22T05:00:00.000Z", cached: true, freshness: "web-search", data: {}, sources: [{ title: "Scorecard", url: "https://example.com/score" }] });
  assert.match(text, /cached from 2026-10-22/);
  assert.match(text, /Never invent a score/);
  assert.match(text, /untrusted live data/);
});

test("context budget fits the local model window", () => {
  const saved = { ctx: process.env.BOBAI_OLLAMA_NUM_CTX, predict: process.env.BOBAI_OLLAMA_NUM_PREDICT, provider: process.env.BOBAI_MODEL_PROVIDER };
  try {
    delete process.env.BOBAI_MODEL_PROVIDER;
    process.env.BOBAI_OLLAMA_NUM_CTX = "4096";
    process.env.BOBAI_OLLAMA_NUM_PREDICT = "1024";
    assert.equal(contextCharacterBudget(), (4096 - 1024 - 64) * 3);
  } finally {
    for (const [key, value] of [["BOBAI_OLLAMA_NUM_CTX", saved.ctx], ["BOBAI_OLLAMA_NUM_PREDICT", saved.predict], ["BOBAI_MODEL_PROVIDER", saved.provider]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("long histories are trimmed to the budget, keeping the newest message", async () => {
  process.env.BOBAI_OLLAMA_NUM_CTX = "2048";
  process.env.BOBAI_OLLAMA_NUM_PREDICT = "512";
  try {
    const messages = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `${index} ${"x".repeat(1500)}` }));
    const prepared = await prepareChat({ messages });
    const total = prepared.providerMessages.reduce((sum, message) => sum + message.content.length, 0);
    assert.ok(total <= contextCharacterBudget() + 1, `prompt ${total} exceeds budget ${contextCharacterBudget()}`);
    assert.match(prepared.providerMessages.at(-1)!.content, /^11 /);
  } finally {
    delete process.env.BOBAI_OLLAMA_NUM_CTX;
    delete process.env.BOBAI_OLLAMA_NUM_PREDICT;
  }
});

test("cricket uses the real scoring feed when a key is configured", async () => {
  const { getLiveData } = await import("../src/services/liveData.js");
  const originalFetch = globalThis.fetch;
  process.env.BOBAI_CRICKET_API_KEY = "test-key";
  let requested = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requested = String(input);
    return new Response(JSON.stringify({ status: "success", data: [
      { name: "India vs Australia, 2nd ODI", status: "India need 42 runs in 36 balls", teams: ["India", "Australia"], matchStarted: true, matchEnded: false, score: [{ r: 289, w: 7, o: 50, inning: "Australia Inning 1" }, { r: 248, w: 5, o: 44, inning: "India Inning 1" }] },
      { name: "England vs Pakistan, 1st Test", status: "Stumps", teams: ["England", "Pakistan"], matchStarted: true, matchEnded: false, score: [] },
    ] }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await getLiveData({ kind: "cricket", query: "India vs Australia score feedtest" });
    assert.equal(result.provider, "CricketData.org");
    assert.equal(result.freshness, "live");
    assert.match(requested, /api\.cricapi\.com\/v1\/currentMatches/);
    const text = JSON.stringify(result.data);
    assert.match(text, /India need 42 runs/);
    assert.match(text, /248\/5 \(44 ov\)/);
    assert.doesNotMatch(text, /England vs Pakistan/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.BOBAI_CRICKET_API_KEY;
  }
});

test("an unreachable Ollama gives a clear, user-safe offline error", async () => {
  const previous = process.env.BOBAI_OLLAMA_BASE_URL;
  process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:9";
  try {
    const { ollamaStream, ModelOfflineError } = await import("../src/services/ollamaProvider.js");
    await assert.rejects(ollamaStream([{ role: "user", content: "hi" }], () => undefined), (error: unknown) => {
      assert.ok(error instanceof ModelOfflineError);
      assert.match(error.publicMessage, /offline/);
      return true;
    });
  } finally {
    if (previous === undefined) delete process.env.BOBAI_OLLAMA_BASE_URL; else process.env.BOBAI_OLLAMA_BASE_URL = previous;
  }
});
