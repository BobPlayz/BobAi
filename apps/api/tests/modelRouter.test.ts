import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { routeChat, routeStream, routeVision, rankModels, classifyTask, routingStatus, resetProviderCache } = await import("../src/services/modelRouter.js");
const { getInventory, resetInventoryCache } = await import("../src/services/modelInventory.js");
const { resetHealth, getHealth } = await import("../src/services/modelHealth.js");
const { ModelUnavailableError } = await import("../src/services/ollamaProvider.js");
const { decideTools } = await import("../src/services/toolDecision.js");

const KEY = ["router", "test", "key", "0123456789"].join("-");
const ENV_KEYS = ["BOBAI_OLLAMA_BASE_URL", "BOBAI_OLLAMA_API_KEY", "BOBAI_OLLAMA_MODEL", "BOBAI_OLLAMA_CODING_MODEL", "BOBAI_OLLAMA_VISION_MODEL", "BOBAI_MODEL_ROUTING", "BOBAI_MODEL_MAX_ATTEMPTS", "BOBAI_MODEL_FIRST_TOKEN_TIMEOUT_MS", "BOBAI_MODEL_ROUTING_LOG", "VERCEL"] as const;

type FakeModel = { name: string; capabilities: string[]; params?: string; context?: number; size?: number };
type ChatHandler = (model: string, body: { stream?: boolean; messages: Array<{ content: string }> }) => Response | Promise<Response>;
type Call = { url: string; model?: string; authorization?: string };

const ndjson = (parts: string[]) => new Response(parts.map((content) => JSON.stringify({ message: { content }, done: false })).join("\n") + "\n" + JSON.stringify({ done: true }) + "\n", { headers: { "content-type": "application/x-ndjson" } });
const answer = (body: { stream?: boolean }, text: string) => body.stream ? ndjson([text.slice(0, 3), text.slice(3)]) : Response.json({ message: { content: text }, done: true });

/** A fake Ollama (local or cloud) with the given models; `chat` decides what each model answers. */
async function withOllama(options: { hosted?: boolean; env?: Record<string, string>; models: FakeModel[]; chat: ChatHandler; tags?: () => Response; me?: () => Response }, fn: (calls: Call[]) => Promise<void>) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const calls: Call[] = [];
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, { BOBAI_MODEL_ROUTING_LOG: "false", BOBAI_OLLAMA_BASE_URL: options.hosted ? "https://ollama.com" : "http://127.0.0.1:11434", ...(options.hosted ? { BOBAI_OLLAMA_API_KEY: KEY } : {}), ...options.env });
  resetInventoryCache(); resetHealth(); resetProviderCache();
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, model: body?.model, authorization: headers.get("authorization") ?? undefined });
    if (url.endsWith("/api/me")) return options.me ? options.me() : Response.json({ name: "tester" });
    if (url.endsWith("/api/version")) return Response.json({ version: "test" });
    if (url.endsWith("/api/ps")) return Response.json({ models: [] });
    if (url.endsWith("/api/tags")) {
      if (options.tags) return options.tags();
      // Like ollama.com: credentials on the catalogue request get an HTML page back.
      if (options.hosted && headers.get("authorization")) return new Response("<html>homepage</html>", { headers: { "content-type": "text/html" } });
      return Response.json({ models: options.models.map((model) => ({ name: model.name, size: model.size ?? 0, details: { parameter_size: options.hosted ? "" : model.params ?? "" }, ...(options.hosted ? { capabilities: model.capabilities } : {}) })) });
    }
    if (url.endsWith("/api/show")) {
      const model = options.models.find((item) => item.name === body.model);
      if (!model) return Response.json({ error: "not found" }, { status: 404 });
      return Response.json({ capabilities: model.capabilities, details: { parameter_size: model.params ?? "" }, model_info: model.context ? { "test.context_length": model.context } : {} });
    }
    if (url.endsWith("/api/generate")) return Response.json({ done: true });
    if (url.endsWith("/api/chat")) {
      // Honour cancellation like real fetch does, so first-token timeouts can be tested.
      const signal = init?.signal;
      return Promise.race([Promise.resolve(options.chat(body.model, body)), new Promise<Response>((_, reject) => {
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      })]);
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  try { await fn(calls); } finally {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    resetInventoryCache(); resetHealth(); resetProviderCache();
  }
}

const MODELS: FakeModel[] = [
  { name: "small-chat", capabilities: ["completion"], params: "2B", context: 32_768 },
  { name: "big-thinker", capabilities: ["completion", "thinking", "tools"], params: "70B", context: 131_072 },
  { name: "eyes", capabilities: ["completion", "vision"], params: "8B", context: 8_192 },
  { name: "embedder", capabilities: ["embedding"], params: "0.6B", context: 8_192 },
];
const user = (content: string) => [{ role: "user" as const, content }];
const chatCalls = (calls: Call[]) => calls.filter((call) => call.url.endsWith("/api/chat")).map((call) => call.model);

test("tasks are classified from the request", () => {
  assert.equal(classifyTask(user("hey how are you")), "chat");
  assert.equal(classifyTask(user("fix this python function that throws an exception")), "coding");
  assert.equal(classifyTask(user("compare these two plans and explain why one is better")), "reasoning");
  assert.equal(classifyTask(user("hi"), "vision"), "vision");
});

test("different tasks pick different suitable models from metadata, never embedding models", async () => {
  await withOllama({ models: MODELS, chat: (model, body) => answer(body, `answer from ${model}`) }, async (calls) => {
    const simple = await routeChat(user("hey, what's up?"));
    assert.equal(simple.model, "small-chat", "a quick chat prefers the small fast model");
    const hard = await routeChat(user("compare these designs and explain why, step by step"));
    assert.equal(hard.model, "big-thinker", "a complex task prefers the larger thinking model");
    const vision = await routeVision("iVBORw0KGgo=", "what is in this picture?");
    assert.equal(vision.model, "eyes", "images need a vision-capable model");
    assert.ok(!chatCalls(calls).includes("embedder"));
    const inventory = await getInventory();
    assert.equal(rankModels(inventory, "tool_decision")[0].name, "big-thinker", "tool decisions prefer tool-capable models");
  });
});

test("a model whose context window is too small for the conversation is skipped", async () => {
  const tiny: FakeModel[] = [{ name: "tiny-window", capabilities: ["completion"], params: "1B", context: 2_048 }, { name: "roomy", capabilities: ["completion"], params: "8B", context: 65_536 }];
  await withOllama({ models: tiny, chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    const result = await routeChat(user("x".repeat(30_000)));
    assert.equal(result.model, "roomy");
  });
});

test("an explicit choice wins; a settings preference is a strong hint, not a requirement", async () => {
  await withOllama({ models: MODELS, env: { BOBAI_OLLAMA_MODEL: "eyes" }, chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    assert.equal((await routeChat(user("hello"))).model, "eyes");
    assert.equal((await routeChat(user("hello"), { preferredModel: "big-thinker" })).model, "big-thinker");
  });
});

test("an unavailable or inaccessible model falls back to the next compatible one and is not retried", async () => {
  await withOllama({ models: MODELS, chat: (model, body) => model === "small-chat" ? Response.json({ error: "not in your plan" }, { status: 403 }) : answer(body, `from ${model}`) }, async (calls) => {
    const first = await routeChat(user("hello there"));
    assert.notEqual(first.model, "small-chat");
    assert.equal(first.fallbacks, 1);
    assert.equal(getHealth("small-chat")?.lastProblem, "access_denied");
    calls.length = 0;
    await routeChat(user("hello again"));
    assert.ok(!chatCalls(calls).includes("small-chat"), "a denied model is skipped on later requests");
  });
});

test("a model suggested by the provider's 403 message is tried next", async () => {
  const models: FakeModel[] = [{ name: "a-model", capabilities: ["completion"], params: "1B" }, { name: "b-model", capabilities: ["completion"], params: "3B" }, { name: "free-model", capabilities: ["completion"], params: "30B" }];
  await withOllama({ hosted: true, models, chat: (model, body) => model === "free-model" ? answer(body, "ok") : Response.json({ error: `model '${model}' requires a subscription. Try free-model-cloud, which is in the Free plan.` }, { status: 403 }) }, async (calls) => {
    const result = await routeChat(user("hi"));
    assert.equal(result.model, "free-model");
    assert.deepEqual(chatCalls(calls), ["a-model", "free-model"]);
  });
});

test("rate limits and timeouts fall back and put the model on a cooldown", async () => {
  await withOllama({ models: MODELS, chat: (model, body) => model === "small-chat" ? new Response("{}", { status: 429 }) : answer(body, `from ${model}`) }, async () => {
    const result = await routeChat(user("hi"));
    assert.notEqual(result.model, "small-chat");
    assert.ok((getHealth("small-chat")?.cooldownUntil ?? 0) > Date.now());
  });
  await withOllama({ models: MODELS, env: { BOBAI_MODEL_FIRST_TOKEN_TIMEOUT_MS: "2000" }, chat: async (model, body) => {
    if (model === "small-chat") { await new Promise((resolve) => setTimeout(resolve, 2_600)); return answer(body, "too late"); }
    return answer(body, `from ${model}`);
  } }, async () => {
    const tokens: string[] = [];
    const result = await routeStream(user("hi"), (token) => tokens.push(token));
    assert.notEqual(result.model, "small-chat");
    assert.equal(tokens.join(""), `from ${result.model}`, "only the answering model's text reaches the user");
    assert.equal(getHealth("small-chat")?.lastProblem, "timeout");
  });
});

test("authentication failures are not retried on other models", async () => {
  await withOllama({ models: MODELS, chat: () => Response.json({ error: "unauthorized" }, { status: 401 }) }, async (calls) => {
    await assert.rejects(routeChat(user("hi")), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "auth");
    assert.equal(chatCalls(calls).length, 1);
  });
  await withOllama({ hosted: true, models: MODELS, me: () => Response.json({ error: "invalid credentials" }, { status: 401 }), chat: () => { throw new Error("must not run"); } }, async (calls) => {
    await assert.rejects(routeChat(user("hi")), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "auth");
    assert.equal(chatCalls(calls).length, 0);
  });
});

test("retries stop at the attempt budget and the last error is reported", async () => {
  const many: FakeModel[] = ["m1", "m2", "m3", "m4", "m5"].map((name) => ({ name, capabilities: ["completion"], params: "1B" }));
  await withOllama({ models: many, env: { BOBAI_MODEL_MAX_ATTEMPTS: "2" }, chat: () => new Response("{}", { status: 500 }) }, async (calls) => {
    await assert.rejects(routeChat(user("hi")), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "failed");
    assert.equal(chatCalls(calls).length, 2);
  });
});

test("a stream that fails after text was sent is not spliced with another model's answer", async () => {
  await withOllama({ models: MODELS, chat: (model) => model === "small-chat"
    ? new Response(JSON.stringify({ message: { content: "Partial " }, done: false }) + "\n" + JSON.stringify({ error: "model crashed" }) + "\n", { headers: { "content-type": "application/x-ndjson" } })
    : ndjson(["should never appear"]) }, async (calls) => {
    const tokens: string[] = [];
    await assert.rejects(routeStream(user("hi"), (token) => tokens.push(token)), (error: unknown) => error instanceof ModelUnavailableError && error.model === "small-chat");
    assert.deepEqual(tokens, ["Partial "]);
    assert.deepEqual(chatCalls(calls), ["small-chat"]);
  });
});

test("a stream that fails before any text recovers on another model with one clean answer", async () => {
  await withOllama({ models: MODELS, chat: (model, body) => model === "small-chat" ? new Response(JSON.stringify({ error: "overloaded" }) + "\n", { headers: { "content-type": "application/x-ndjson" } }) : answer(body, "clean answer") }, async () => {
    const tokens: string[] = [];
    const result = await routeStream(user("hi"), (token) => tokens.push(token));
    assert.equal(tokens.join(""), "clean answer");
    assert.equal(result.content, "clean answer");
    assert.equal(result.fallbacks, 1);
  });
});

test("tool decisions fall back between models without running anything twice", async () => {
  let decisions = 0;
  await withOllama({ models: MODELS, chat: (model, body) => {
    if (model === "big-thinker") return new Response("{}", { status: 503 });
    decisions += 1;
    return answer(body, JSON.stringify({ action: "respond" }));
  } }, async () => {
    const decision = await decideTools(user("what's 2+2?"));
    assert.equal(decision.action, "respond");
    assert.equal(decisions, 1, "exactly one successful decision; tools run only after the decision returns");
  });
});

test("no compatible model and failed discovery give clear errors", async () => {
  await withOllama({ models: [MODELS[0]], chat: (_model, body) => answer(body, "x") }, async () => {
    await assert.rejects(routeVision("iVBORw0KGgo=", "describe"), (error: unknown) => error instanceof ModelUnavailableError && error.problem === "no_model" && /vision/.test(error.message));
  });
  await withOllama({ models: [], tags: () => new Response("down", { status: 500 }), chat: (_model, body) => answer(body, "x") }, async () => {
    await assert.rejects(routeChat(user("hi")), (error: unknown) => error instanceof ModelUnavailableError && /discovery failed/.test(error.message));
    const status = await routingStatus();
    assert.equal(status.ready, false);
    assert.equal(status.problem, "discovery_failed");
  });
  await withOllama({ models: [], env: { BOBAI_OLLAMA_MODEL: "configured-model" }, tags: () => new Response("down", { status: 500 }), chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    assert.equal((await routeChat(user("hi"))).model, "configured-model", "a configured preference still works when listing fails");
  });
});

test("a stale model list is reused when a refresh fails", async () => {
  let up = true;
  await withOllama({ models: MODELS, tags: () => up ? Response.json({ models: MODELS.map((model) => ({ name: model.name })) }) : new Response("down", { status: 500 }), chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    assert.equal((await getInventory()).models.length, 3);
    up = false;
    const stale = await getInventory({ refresh: true });
    assert.equal(stale.stale, true);
    assert.equal(stale.models.length, 3);
    assert.ok((await routeChat(user("hi"))).model);
  });
});

test("Ollama Cloud lists the public catalogue without credentials; local Ollama lists installed models", async () => {
  await withOllama({ hosted: true, models: MODELS, chat: (model, body) => answer(body, `from ${model}`) }, async (calls) => {
    const inventory = await getInventory();
    assert.equal(inventory.hosted, true);
    assert.ok(inventory.models.every((model) => !model.installed), "cloud models are listed, not proven usable");
    const tagCalls = calls.filter((call) => call.url.endsWith("/api/tags"));
    assert.equal(tagCalls.at(-1)?.authorization, undefined);
    assert.ok(calls.filter((call) => call.url.endsWith("/api/chat")).length === 0, "discovery never runs inference");
    const result = await routeChat(user("hi"));
    assert.equal(calls.find((call) => call.url.endsWith("/api/chat"))?.authorization, `Bearer ${KEY}`);
    assert.equal(getHealth(result.model)?.verified, true, "a successful answer proves the account can use the model");
  });
  await withOllama({ models: [...MODELS, { name: "too-big", capabilities: ["completion"], params: "400B", size: 10 ** 15 }], chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    const inventory = await getInventory();
    assert.ok(inventory.models.every((model) => model.installed));
    assert.ok(!inventory.models.some((model) => model.name === "too-big"), "local models that cannot fit in memory are skipped");
  });
});

test("routing logs carry model metadata only, never prompts, answers or keys", async () => {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  try {
    await withOllama({ hosted: true, env: { BOBAI_MODEL_ROUTING_LOG: "true" }, models: MODELS, chat: (_model, body) => answer(body, "the secret answer") }, async () => {
      await routeChat(user("my private question about my diary"));
    });
  } finally { console.log = originalLog; }
  const routing = lines.filter((line) => line.includes("model_attempt"));
  assert.ok(routing.length >= 1);
  for (const line of routing) {
    assert.ok(!line.includes("diary") && !line.includes("secret answer") && !line.includes(KEY));
  }
});

test("simultaneous users are served in parallel on Ollama Cloud but one at a time on a local machine", async () => {
  for (const hosted of [true, false]) {
    let active = 0, peak = 0;
    await withOllama({ hosted, models: MODELS, chat: async (_model, body) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 80));
      active -= 1;
      return answer(body, "ok");
    } }, async () => {
      await Promise.all([routeChat(user("hi")), routeChat(user("hello"))]);
    });
    assert.equal(peak, hosted ? 2 : 1, hosted ? "cloud requests must not queue behind each other" : "local inference stays serialized for RAM");
  }
});

test("a bad key or unreachable server does not put the model on a cooldown", async () => {
  await withOllama({ models: MODELS, chat: () => Response.json({ error: "unauthorized" }, { status: 401 }) }, async () => {
    await assert.rejects(routeChat(user("hi")));
    assert.equal(getHealth("small-chat")?.cooldownUntil, undefined);
    assert.equal(getHealth("small-chat")?.failures ?? 0, 0);
  });
});

test("everyday code goes to a mid-size model; only hard requests use the biggest, most expensive one", async () => {
  const models: FakeModel[] = [
    { name: "small", capabilities: ["completion"], params: "20B", context: 131_072 },
    { name: "mid", capabilities: ["completion"], params: "120B", context: 131_072 },
    { name: "huge", capabilities: ["completion"], params: "671B", context: 131_072 },
  ];
  await withOllama({ models, chat: (model, body) => answer(body, `from ${model}`) }, async () => {
    const inventory = await getInventory();
    assert.equal(rankModels(inventory, "chat")[0].name, "small", "plain chat uses the cheapest model");
    assert.equal(rankModels(inventory, "coding")[0].name, "mid", "everyday code doesn't need the biggest model");
    assert.equal(rankModels(inventory, "coding", { hard: true })[0].name, "huge", "hard requests still get the strongest");
    const reply = await routeChat([{ role: "user", content: "write a python function to reverse a string" }]);
    assert.equal(reply.model, "mid");
  });
});
