import { withLocalModelLock } from "../src/services/localModelLock.js";
import test from "node:test";
import assert from "node:assert/strict";
import { BobModelProvider } from "../src/services/modelProvider.js";
import { ModelUnavailableError, ollamaChat, ollamaEmbedding, ollamaEmbeddingEnabled, ollamaEmbeddingModel, ollamaModelFor, ollamaStatus, ollamaStream, ollamaVision, ollamaVisionModel, preferredModel, unloadOllamaModels } from "../src/services/ollamaProvider.js";

const originalFetch = globalThis.fetch;
const keys = ["BOBAI_OLLAMA_BASE_URL", "BOBAI_OLLAMA_MODEL", "BOBAI_OLLAMA_CODING_MODEL", "BOBAI_OLLAMA_VISION_MODEL", "BOBAI_OLLAMA_TIMEOUT_MS", "BOBAI_OLLAMA_NUM_CTX", "BOBAI_OLLAMA_NUM_PREDICT", "BOBAI_OLLAMA_THINK", "BOBAI_OLLAMA_EMBEDDING_MODEL"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<(typeof keys)[number], string | undefined>;
function restore() {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key]!;
  }
}

test("there is no built-in default model: the router picks one, settings are only a preference", () => {
  try {
    for (const key of keys) delete process.env[key];
    assert.throws(() => ollamaModelFor("bob"), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "no_model");
    assert.throws(() => ollamaVisionModel(), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "no_model");
    assert.equal(preferredModel("chat"), undefined);
    assert.equal(ollamaModelFor("bob", "some-model:7b"), "some-model:7b");
    process.env.BOBAI_OLLAMA_MODEL = "pref:1b";
    process.env.BOBAI_OLLAMA_CODING_MODEL = "coder:1b";
    assert.equal(preferredModel("chat"), "pref:1b");
    assert.equal(preferredModel("coding"), "coder:1b");
    assert.equal(preferredModel("vision"), "pref:1b");
    assert.equal(ollamaEmbeddingEnabled(), false);
    assert.equal(ollamaEmbeddingModel(), "qwen3-embedding:0.6b");
    assert.equal(new BobModelProvider().isConfigured(), true);
  } finally { restore(); }
});

test("Ollama chat sends requests only to the configured local runtime", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    process.env.BOBAI_OLLAMA_MODEL = "qwen2.5:3b";
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith("/api/ps")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
      assert.equal(String(input), "http://127.0.0.1:11434/api/chat");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "qwen2.5:3b");
      assert.equal(body.stream, false);
      assert.equal(body.think, false);
      assert.equal(body.options.num_ctx, 4096);
      return new Response(JSON.stringify({ message: { content: "  local answer  " }, done: true }), { status: 200 });
    };
    const result = await ollamaChat([{ role: "user", content: "hello" }], "bob");
    assert.deepEqual(result, { content: "local answer", model: "qwen2.5:3b", finishReason: "stop" });
  } finally { restore(); }
});

test("coding requests use the separate local coder model", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.BOBAI_OLLAMA_CODING_MODEL = "qwen2.5-coder:3b";
    globalThis.fetch = async (_input, init) => {
      assert.equal(JSON.parse(String(init?.body)).model, "qwen2.5-coder:3b");
      return new Response(JSON.stringify({ message: { content: "function add(a, b) { return a + b; }" } }), { status: 200 });
    };
    const result = await ollamaChat([{ role: "user", content: "write a function" }], "coding");
    assert.equal(result.model, "qwen2.5-coder:3b");
  } finally { restore(); }
});

test("Ollama streaming parses newline-delimited JSON tokens", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    globalThis.fetch = async (input) => String(input).endsWith("/api/ps")
      ? new Response(JSON.stringify({ models: [] }), { status: 200 })
      : new Response(
          '{"message":{"content":"Hello"},"done":false}\n{"message":{"content":" world"},"done":true}\n',
          { status: 200, headers: { "content-type": "application/x-ndjson" } },
        );
    const tokens: string[] = [];
    const result = await ollamaStream([{ role: "user", content: "hello" }], token => tokens.push(token), "bob", "local-model:1b");
    assert.equal(result.content, "Hello world");
    assert.deepEqual(tokens, ["Hello", " world"]);
  } finally { restore(); }
});

test("Ollama rejects insecure remote HTTP endpoints", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://example.com:11434";
    await assert.rejects(new BobModelProvider().chat([{ role: "user", content: "hello" }]), /must use HTTPS/);
  } finally { restore(); }
});

test("Ollama status checks the provider, never model names, and does not expose credentials", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    globalThis.fetch = async () => new Response(JSON.stringify({ models: [] }), { status: 200 });
    const status = await ollamaStatus();
    assert.deepEqual(status, { ready: true, provider: "ollama", hosted: false });
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    const down = await ollamaStatus();
    assert.equal(down.ready, false);
    assert.equal(down.problem, "unreachable");
    assert.equal(JSON.stringify(down).includes("secret"), false);
  } finally { restore(); }
});

test("Ollama vision sends image bytes only to the configured local runtime", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    process.env.BOBAI_OLLAMA_VISION_MODEL = "moondream:1.8b";
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith("/api/ps")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
      assert.equal(String(input), "http://127.0.0.1:11434/api/chat");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "moondream:1.8b");
      assert.equal(body.stream, false);
      assert.equal(body.think, false);
      assert.equal(body.messages[0].role, "system");
      assert.match(body.messages[0].content, /untrusted data/i);
      assert.deepEqual(body.messages[1].images, ["iVBORw0KGgo="]);
      return new Response(JSON.stringify({ message: { content: "A cat on a chair." } }), { status: 200 });
    };
    assert.deepEqual(await ollamaVision("iVBORw0KGgo=", "Describe the image"), { content: "A cat on a chair.", model: "moondream:1.8b" });
  } finally { restore(); }
});

test("Ollama model unload releases resident weights before a memory-heavy image task", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/ps")) return new Response(JSON.stringify({ models: [{ name: "qwen3.5:2b" }, { name: "qwen3.5:2b" }] }), { status: 200 });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url, body });
      return new Response(JSON.stringify({ response: "", done: true }), { status: 200 });
    };
    assert.deepEqual(await unloadOllamaModels(), ["qwen3.5:2b"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:11434/api/generate");
    assert.equal(calls[0].body?.model, "qwen3.5:2b");
    assert.equal(calls[0].body?.keep_alive, 0);
  } finally { restore(); }
});

test("heavy local model work is serialized instead of overlapping in RAM", async () => {
  let active = 0;
  let maximumActive = 0;
  const task = () => withLocalModelLock(async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
  });
  await Promise.all([task(), task(), task()]);
  assert.equal(maximumActive, 1);
});

test("semantic embedding requests normalize vectors to the database dimension and unload afterward", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    process.env.BOBAI_OLLAMA_EMBEDDING_MODEL = "qwen3-embedding:0.6b";
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/ps")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url, body });
      return new Response(JSON.stringify({ embeddings: [[3, 4]] }), { status: 200 });
    };
    const vector = await ollamaEmbedding("remember this fact");
    assert.equal(vector?.length, 1536);
    assert.ok(Math.abs(vector![0] - 0.6) < 1e-9);
    assert.ok(Math.abs(vector![1] - 0.8) < 1e-9);
    assert.equal(vector!.slice(2).every((value) => value === 0), true);
    assert.equal(calls[0].url, "http://127.0.0.1:11434/api/embed");
    assert.equal(calls[0].body?.model, "qwen3-embedding:0.6b");
    assert.equal(calls[0].body?.keep_alive, 0);
  } finally { restore(); }
});

test("switching models unloads other resident tags but keeps the selected tag", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    process.env.BOBAI_OLLAMA_MODEL = "qwen3.5:4b";
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/ps")) return new Response(JSON.stringify({
        models: [{ name: "qwen3.5:4b" }, { name: "qwen2.5-coder:3b" }],
      }), { status: 200 });
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      calls.push({ url, body });
      if (url.endsWith("/api/generate")) return new Response(JSON.stringify({ response: "", done: true }), { status: 200 });
      return new Response(JSON.stringify({ message: { content: "ready" } }), { status: 200 });
    };
    const result = await ollamaChat([{ role: "user", content: "hello" }], "bob");
    assert.equal(result.model, "qwen3.5:4b");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "http://127.0.0.1:11434/api/generate");
    assert.equal(calls[0].body?.model, "qwen2.5-coder:3b");
    assert.equal(calls[0].body?.keep_alive, 0);
    assert.equal(calls[1].url, "http://127.0.0.1:11434/api/chat");
  } finally { restore(); }
});
