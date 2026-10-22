import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createGateway, Limiter, loadConfig } from "../src/gateway.js";

const TOKEN = "t".repeat(40);

/** A fake Ollama that streams NDJSON slowly and records what it was asked for. */
function fakeOllama() {
  const seen: string[] = [];
  let active = 0, peak = 0;
  const server = createServer(async (req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url === "/api/version") { res.end(JSON.stringify({ version: "test" })); return; }
    if (req.url === "/api/tags") { res.end(JSON.stringify({ models: [{ name: "qwen3.5:2b" }] })); return; }
    active += 1; peak = Math.max(peak, active);
    res.writeHead(200, { "content-type": "application/x-ndjson" });
    for (const word of ["Hel", "lo"]) { res.write(JSON.stringify({ message: { content: word }, done: false }) + "\n"); await new Promise((r) => setTimeout(r, 40)); }
    res.end(JSON.stringify({ done: true }) + "\n");
    active -= 1;
  });
  return { server, seen, peak: () => peak };
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

test("config refuses a missing or short token", () => {
  assert.throws(() => loadConfig({}), /GATEWAY_TOKEN/);
  assert.throws(() => loadConfig({ GATEWAY_TOKEN: "short" }), /GATEWAY_TOKEN/);
  assert.equal(loadConfig({ GATEWAY_TOKEN: TOKEN }).maxConcurrent, 1);
});

test("gateway authenticates, allow-lists endpoints and models, streams, and limits concurrency", async () => {
  const ollama = fakeOllama();
  const ollamaUrl = await listen(ollama.server);
  const gateway = createGateway(loadConfig({ GATEWAY_TOKEN: TOKEN, OLLAMA_URL: ollamaUrl, GATEWAY_ALLOWED_MODELS: "qwen3.5:2b" }));
  const base = await listen(gateway);
  const auth = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
  const chat = (model: string, headers: Record<string, string> = auth) => fetch(`${base}/api/chat`, { method: "POST", headers, body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], stream: true }) });
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200, "health is public");
    assert.equal((await chat("qwen3.5:2b", { "content-type": "application/json" })).status, 401, "no token");
    assert.equal((await chat("qwen3.5:2b", { ...auth, authorization: `Bearer ${"x".repeat(40)}` })).status, 401, "wrong token");
    assert.equal((await chat("llama3:70b")).status, 403, "model not allowed");
    assert.equal((await fetch(`${base}/api/pull`, { method: "POST", headers: auth, body: JSON.stringify({ model: "qwen3.5:2b" }) })).status, 404, "pull is never forwarded");
    assert.equal((await fetch(`${base}/api/delete`, { method: "DELETE", headers: auth })).status, 404, "delete is never forwarded");
    const tags = await fetch(`${base}/api/tags`, { headers: auth });
    assert.equal(tags.status, 200);

    const response = await chat("qwen3.5:2b");
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /"Hel"/);
    assert.match(text, /"done":true/);

    // Two chats at once: with maxConcurrent 1 the second waits, so Ollama never runs two at the same time.
    const both = await Promise.all([chat("qwen3.5:2b"), chat("qwen3.5:2b")]);
    await Promise.all(both.map((item) => item.text()));
    assert.equal(ollama.peak(), 1);
    assert.ok(!ollama.seen.some((line) => line.includes("pull") || line.includes("delete")));
  } finally {
    gateway.close(); ollama.server.close();
  }
});

test("limiter rejects when the queue is full", async () => {
  const limiter = new Limiter(1, 0);
  const release = await limiter.acquire(new AbortController().signal);
  await assert.rejects(limiter.acquire(new AbortController().signal), /busy/);
  release();
});
