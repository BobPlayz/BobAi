import test from "node:test";
import assert from "node:assert/strict";
import { BobModelProvider } from "../src/services/modelProvider.js";
import { ollamaModelFor, ollamaStatus } from "../src/services/ollamaProvider.js";

const originalFetch = globalThis.fetch;
const keys = ["BOBAI_OLLAMA_BASE_URL", "BOBAI_OLLAMA_MODEL", "BOBAI_OLLAMA_CODING_MODEL", "BOBAI_OLLAMA_TIMEOUT_MS"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<(typeof keys)[number], string | undefined>;
function restore() {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key]!;
  }
}

test("BobAI defaults to local Ollama models without API credentials", () => {
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(ollamaModelFor("bob"), "qwen2.5:3b");
    assert.equal(ollamaModelFor("coding"), "qwen2.5-coder:3b");
    assert.equal(new BobModelProvider().isConfigured(), true);
  } finally { restore(); }
});

test("Ollama chat sends requests only to the configured local runtime", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    process.env.BOBAI_OLLAMA_MODEL = "qwen2.5:3b";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "http://127.0.0.1:11434/api/chat");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "qwen2.5:3b");
      assert.equal(body.stream, false);
      return new Response(JSON.stringify({ message: { content: "  local answer  " }, done: true }), { status: 200 });
    };
    const result = await new BobModelProvider().chat([{ role: "user", content: "hello" }]);
    assert.deepEqual(result, { content: "local answer", model: "qwen2.5:3b", provider: "bob" });
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
    const result = await new BobModelProvider().chat([{ role: "user", content: "write a function" }], "coding");
    assert.equal(result.model, "qwen2.5-coder:3b");
    assert.equal(result.provider, "coding");
  } finally { restore(); }
});

test("Ollama streaming parses newline-delimited JSON tokens", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    globalThis.fetch = async () => new Response(
      '{"message":{"content":"Hello"},"done":false}\n{"message":{"content":" world"},"done":true}\n',
      { status: 200, headers: { "content-type": "application/x-ndjson" } },
    );
    const tokens: string[] = [];
    const result = await new BobModelProvider().stream([{ role: "user", content: "hello" }], token => tokens.push(token));
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

test("Ollama status does not expose credentials and reports required local models", async () => {
  try {
    process.env.BOBAI_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    globalThis.fetch = async () => new Response(JSON.stringify({ models: [{ name: "qwen2.5:3b" }] }), { status: 200 });
    const status = await ollamaStatus();
    assert.equal(status.provider, "ollama");
    assert.equal(status.ready, false);
    assert.deepEqual(status.missingModels, ["qwen2.5-coder:3b"]);
    assert.equal(JSON.stringify(status).includes("secret"), false);
  } finally { restore(); }
});
