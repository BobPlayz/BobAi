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
  const cases: Array<[number, string]> = [[401, "auth"], [403, "access_denied"], [404, "model_missing"], [429, "rate_limited"], [503, "busy"], [504, "timeout"], [502, "unreachable"], [500, "failed"]];
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
    await assert.rejects(ollamaStream([{ role: "user", content: "hi" }], () => undefined, "bob", "any-model:1b"), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "not_configured");
    assert.equal(calls.length, 0);
  });
  await withFakeOllama({ BOBAI_OLLAMA_BASE_URL: "https://ollama.com", BOBAI_OLLAMA_MODEL: "gemma4:31b" }, () => { throw new Error("must not be called"); }, async (calls) => {
    await assert.rejects(ollamaChat([{ role: "user", content: "hi" }]), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "not_configured");
    assert.equal(calls.length, 0);
  });
});

test("Ollama Cloud provider status checks the key with /api/me and never lists models with credentials", async () => {
  await withFakeOllama(cloud, (call) => call.url.endsWith("/api/me") ? Response.json({ name: "tester" }) : new Response("<html>", { status: 200 }), async (calls) => {
    assert.deepEqual(await ollamaStatus(), { ready: true, provider: "ollama", hosted: true });
    assert.equal(calls.length, 1);
  });
  await withFakeOllama(cloud, () => Response.json({ error: "invalid credentials" }, { status: 401 }), async () => {
    const status = await ollamaStatus();
    assert.equal(status.ready, false);
    assert.equal(status.problem, "auth");
  });
});

test("a 403 that names an allowed model passes the suggestion on to the router", async () => {
  await withFakeOllama(cloud, () => Response.json({ error: "model 'big:1t' is not in your plan. Try gemma4:31b-cloud, which is in the Free plan." }, { status: 403 }), async () => {
    await assert.rejects(ollamaChat([{ role: "user", content: "hi" }], "bob", "big:1t"), (error: unknown) => {
      assert.ok(error instanceof ModelUnavailableError);
      assert.equal(error.problem, "access_denied");
      assert.equal(error.suggestedModel, "gemma4:31b");
      return true;
    });
  });
});
