import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { ollamaChat, ollamaStream, ollamaStatus, ModelUnavailableError } = await import("../src/services/ollamaProvider.js");

const KEY = ["test", "ollama", "key", "0123456789"].join("-");
const ENV_KEYS = ["BOBAI_OLLAMA_BASE_URL", "BOBAI_OLLAMA_API_KEY", "BOBAI_OLLAMA_MODEL", "VERCEL"] as const;

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

/** Runs `fn` with a fake fetch and the given Ollama settings, restoring everything afterwards. */
async function withFakeOllama(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, handler: (call: Call) => Response | Promise<Response>, fn: (calls: Call[]) => Promise<void>) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const calls: Call[] = [];
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? "GET", headers: Object.fromEntries(new Headers(init?.headers).entries()), body: typeof init?.body === "string" ? init.body : undefined };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  try { await fn(calls); } finally {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

const cloud = { BOBAI_OLLAMA_BASE_URL: "https://ollama.com", BOBAI_OLLAMA_API_KEY: KEY, BOBAI_OLLAMA_MODEL: "gemma4:31b" };
const ndjson = (lines: unknown[]) => new Response(lines.map((line) => JSON.stringify(line)).join("\n") + "\n", { status: 200, headers: { "content-type": "application/x-ndjson" } });

test("Ollama Cloud chat uses the official endpoint, bearer key and model, and parses the answer", async () => {
  await withFakeOllama(cloud, () => Response.json({ model: "gemma4:31b", message: { role: "assistant", content: "Hello there." }, done: true }), async (calls) => {
    const result = await ollamaChat([{ role: "user", content: "hi" }]);
    assert.equal(result.content, "Hello there.");
    const chat = calls.find((call) => call.url.endsWith("/api/chat"))!;
    assert.equal(chat.url, "https://ollama.com/api/chat");
    assert.equal(chat.method, "POST");
    assert.equal(chat.headers.authorization, `Bearer ${KEY}`);
    const body = JSON.parse(chat.body!);
    assert.equal(body.model, "gemma4:31b");
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
    assert.ok(!calls.some((call) => call.url.endsWith("/api/ps")), "hosted Ollama is never asked to unload models");
  });
});

test("Ollama Cloud streaming joins content tokens and ignores thinking-only chunks", async () => {
  await withFakeOllama(cloud, () => ndjson([{ message: { role: "assistant", content: "", thinking: "hmm" }, done: false }, { message: { content: "Hel" }, done: false }, { message: { content: "lo" }, done: false }, { done: true }]), async () => {
    const tokens: string[] = [];
    const result = await ollamaStream([{ role: "user", content: "hi" }], (token) => tokens.push(token));
    assert.deepEqual(tokens, ["Hel", "lo"]);
    assert.equal(result.content, "Hello");
  });
});

test("provider failures become specific, user-safe errors", async () => {
  const cases: Array<[number, string]> = [[401, "auth"], [403, "auth"], [404, "model_missing"], [429, "rate_limited"], [503, "busy"], [504, "timeout"], [502, "unreachable"]];
  for (const [status, problem] of cases) {
    await withFakeOllama(cloud, () => new Response(JSON.stringify({ error: "nope" }), { status }), async () => {
      await assert.rejects(ollamaStream([{ role: "user", content: "hi" }], () => undefined), (error: unknown) => {
        assert.ok(error instanceof ModelUnavailableError, `HTTP ${status}`);
        assert.equal(error.problem, problem, `HTTP ${status}`);
        assert.ok(!error.publicMessage.includes(KEY));
        return true;
      });
    });
  }
});

test("a generation error inside the stream is reported, not turned into an answer", async () => {
  await withFakeOllama(cloud, () => ndjson([{ message: { content: "partial" }, done: false }, { error: "model crashed" }]), async () => {
    await assert.rejects(ollamaStream([{ role: "user", content: "hi" }], () => undefined), /generation error/);
  });
});

test("missing configuration fails before any request", async () => {
  await withFakeOllama({ VERCEL: "1" }, () => { throw new Error("must not be called"); }, async (calls) => {
    await assert.rejects(ollamaStream([{ role: "user", content: "hi" }], () => undefined), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "not_configured");
    assert.equal(calls.length, 0);
  });
  await withFakeOllama({ BOBAI_OLLAMA_BASE_URL: "https://ollama.com", BOBAI_OLLAMA_MODEL: "gemma4:31b" }, () => { throw new Error("must not be called"); }, async (calls) => {
    await assert.rejects(ollamaChat([{ role: "user", content: "hi" }]), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "not_configured");
    assert.equal(calls.length, 0);
  });
});

test("Ollama Cloud readiness checks the key with /api/me and the model with /api/show", async () => {
  const handler = (good: { key: boolean; model: boolean }) => (call: Call) => {
    if (call.url.endsWith("/api/me")) return good.key ? Response.json({ name: "tester" }) : Response.json({ error: "invalid credentials" }, { status: 401 });
    if (call.url.endsWith("/api/show")) return good.model ? Response.json({ capabilities: ["completion"] }) : Response.json({ error: "not found" }, { status: 404 });
    return new Response("<html>homepage</html>", { status: 200, headers: { "content-type": "text/html" } });
  };
  await withFakeOllama(cloud, handler({ key: true, model: true }), async (calls) => {
    const status = await ollamaStatus();
    assert.equal(status.ready, true);
    assert.equal(status.hosted, true);
    assert.ok(!calls.some((call) => call.url.endsWith("/api/tags")), "tags is not a key check on ollama.com");
  });
  await withFakeOllama(cloud, handler({ key: false, model: true }), async () => {
    const status = await ollamaStatus();
    assert.equal(status.ready, false);
    assert.equal(status.problem, "auth");
  });
  await withFakeOllama(cloud, handler({ key: true, model: false }), async () => {
    const status = await ollamaStatus();
    assert.equal(status.problem, "model_missing");
    assert.deepEqual(status.missingModels, ["gemma4:31b"]);
  });
});

test("local Ollama readiness still uses /api/tags and reports missing models", async () => {
  await withFakeOllama({ BOBAI_OLLAMA_BASE_URL: "http://127.0.0.1:11434", BOBAI_OLLAMA_MODEL: "qwen3.5:2b" }, () => Response.json({ models: [{ name: "llama3:8b" }] }), async () => {
    const status = await ollamaStatus();
    assert.equal(status.ready, false);
    assert.equal(status.hosted, false);
    assert.equal(status.problem, "model_missing");
  });
});
