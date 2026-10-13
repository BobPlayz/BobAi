import test from "node:test";
import assert from "node:assert/strict";
import { BobModelProvider } from "../src/services/modelProvider.js";

const originalFetch = globalThis.fetch;
const keys = ["NODE_ENV", "BOBAI_PROVIDER", "BOBAI_MODEL_NAME", "BOBAI_CODING_MODEL_NAME", "OPENAI_API_KEY", "BOBAI_OPENAI_BASE_URL", "BOBAI_OPENAI_MODEL"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<(typeof keys)[number], string | undefined>;
function restore() {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key]!;
  }
}

test("retired Ollama model id is rejected instead of routed to a local service", async () => {
  try {
    delete process.env.BOBAI_PROVIDER;
    process.env.BOBAI_MODEL_NAME = "ollama-local";
    await assert.rejects(new BobModelProvider().chat([{ role: "user", content: "hello" }]), /unsupported model/);
  } finally {
    restore();
  }
});

test("hosted provider selection also routes coding model requests to the hosted adapter", async () => {
  try {
    process.env.BOBAI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.BOBAI_OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.BOBAI_OPENAI_MODEL = "test-model";
    delete process.env.BOBAI_MODEL_NAME;
    delete process.env.BOBAI_CODING_MODEL_NAME;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "test-model");
      return new Response(JSON.stringify({ choices: [{ message: { content: "coding answer" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await new BobModelProvider().chat([{ role: "user", content: "write a function" }], "coding");
    assert.equal(result.content, "coding answer");
    assert.equal(result.model, "test-model");
    assert.equal(result.provider, "coding");
  } finally {
    restore();
  }
});

test("production accepts only the configured hosted model", async () => {
  try {
    process.env.NODE_ENV = "production";
    process.env.BOBAI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    await assert.rejects(
      new BobModelProvider().chat([{ role: "user", content: "hello" }], "bob", "bob-production"),
      /Only the configured hosted provider is available in production/,
    );
  } finally {
    restore();
  }
});
