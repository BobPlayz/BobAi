import test from "node:test";
import assert from "node:assert/strict";
import { openAIBaseUrl, openAIConfigured, openAIStatus } from "../src/services/openAIProvider.js";

test("hosted provider accepts HTTPS endpoints and loopback HTTP for local-compatible servers", () => {
  assert.equal(openAIBaseUrl("https://api.openai.com/v1/"), "https://api.openai.com/v1");
  assert.equal(openAIBaseUrl("http://127.0.0.1:8080/v1"), "http://127.0.0.1:8080/v1");
});

test("hosted provider rejects insecure remote endpoints and URL credentials", () => {
  for (const value of [
    "http://api.openai.com/v1",
    "https://user:pass@example.com/v1",
    "https://example.com/v1?debug=true",
    "https://example.com/v1#fragment",
    "not-a-url",
  ]) {
    assert.throws(() => openAIBaseUrl(value));
  }
});

test("hosted provider is opt-in and reports missing credentials without exposing secrets", () => {
  const previous = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal(openAIConfigured(), false);
    const status = openAIStatus();
    assert.equal(status.ready, false);
    assert.equal(status.error, "OPENAI_API_KEY is not configured");
    process.env.OPENAI_API_KEY = "test-key";
    assert.equal(openAIConfigured(), true);
    assert.equal(openAIStatus().ready, true);
    assert.equal(JSON.stringify(openAIStatus()).includes("test-key"), false);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
