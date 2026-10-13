import test from "node:test";
import assert from "node:assert/strict";
import { openAIBaseUrl, openAIChat, openAIConfigured, openAIStatus, openAIStream, openAIImageAnalysis, openAIImageGenerate } from "../src/services/openAIProvider.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalBase = process.env.BOBAI_OPENAI_BASE_URL;
const originalModel = process.env.BOBAI_OPENAI_MODEL;
const originalImageModel = process.env.BOBAI_OPENAI_IMAGE_MODEL;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  if (originalBase === undefined) delete process.env.BOBAI_OPENAI_BASE_URL; else process.env.BOBAI_OPENAI_BASE_URL = originalBase;
  if (originalModel === undefined) delete process.env.BOBAI_OPENAI_MODEL; else process.env.BOBAI_OPENAI_MODEL = originalModel;
  if (originalImageModel === undefined) delete process.env.BOBAI_OPENAI_IMAGE_MODEL; else process.env.BOBAI_OPENAI_IMAGE_MODEL = originalImageModel;
}

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
    restoreEnvironment();
  }
});

test("hosted chat sends the configured model and returns a valid answer", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.BOBAI_OPENAI_MODEL = "test-model";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.openai.com/v1/chat/completions");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "test-model");
      assert.equal(body.stream, false);
      return new Response(JSON.stringify({ choices: [{ message: { content: "  Hello from test  " } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await openAIChat([{ role: "user", content: "Hello" }]);
    assert.deepEqual(result, { content: "Hello from test", model: "test-model" });
  } finally {
    restoreEnvironment();
  }
});

test("hosted chat turns quota and authentication failures into safe messages", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response("private provider error details", { status: 429 });
    await assert.rejects(openAIChat([{ role: "user", content: "Hello" }]), /rate limit or quota reached/);
    globalThis.fetch = async () => new Response("private provider error details", { status: 401 });
    await assert.rejects(openAIChat([{ role: "user", content: "Hello" }]), /authentication failed/);
  } finally {
    restoreEnvironment();
  }
});

test("hosted chat rejects malformed and empty model responses", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response("{not json", { status: 200 });
    await assert.rejects(openAIChat([{ role: "user", content: "Hello" }]), /invalid JSON/);
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 });
    await assert.rejects(openAIChat([{ role: "user", content: "Hello" }]), /invalid or empty answer/);
  } finally {
    restoreEnvironment();
  }
});

test("hosted streaming parses SSE chunks and returns the accumulated answer", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
    const tokens: string[] = [];
    const result = await openAIStream([{ role: "user", content: "Hello" }], (token) => tokens.push(token));
    assert.equal(result.content, "Hello world");
    assert.deepEqual(tokens, ["Hello", " world"]);
  } finally {
    restoreEnvironment();
  }
});

test("hosted streaming rejects an empty answer", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response("data: [DONE]\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    await assert.rejects(openAIStream([{ role: "user", content: "Hello" }], () => undefined), /empty answer/);
  } finally {
    restoreEnvironment();
  }
});

test("hosted streaming propagates an already-aborted client signal", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.signal?.aborted, true);
      throw new DOMException("The operation was aborted.", "AbortError");
    };
    await assert.rejects(openAIStream([{ role: "user", content: "Hello" }], () => undefined, controller.signal), /aborted/i);
  } finally {
    restoreEnvironment();
  }
});

test("hosted image analysis sends supported image data through the server-side provider", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.BOBAI_OPENAI_MODEL = "vision-test-model";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.openai.com/v1/chat/completions");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "vision-test-model");
      assert.equal(body.messages[0].content[0].text, "Describe this test image.");
      assert.equal(body.messages[0].content[1].image_url.url, "data:image/png;base64,iVBORw==");
      return new Response(JSON.stringify({ choices: [{ message: { content: "A test image." } }] }), { status: 200 });
    };
    const result = await openAIImageAnalysis("data:image/png;base64,iVBORw==", "Describe this test image.");
    assert.deepEqual(result, { model: "vision-test-model", response: "A test image." });
  } finally { restoreEnvironment(); }
});

test("hosted image analysis rejects unsupported or oversized image data before fetch", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => { throw new Error("fetch must not run for invalid image data"); };
    await assert.rejects(openAIImageAnalysis("data:image/svg+xml;base64,PHN2Zz4=", "describe"), /supported PNG, JPEG, or WebP/);
    await assert.rejects(openAIImageAnalysis("not-an-image", "describe"), /supported PNG, JPEG, or WebP/);
  } finally { restoreEnvironment(); }
});

test("hosted image generation uses a real image endpoint and returns image bytes", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.BOBAI_OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.BOBAI_OPENAI_IMAGE_MODEL = "test-image-model";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.openai.com/v1/images/generations");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "test-image-model");
      assert.equal(body.quality, "low");
      assert.equal(body.n, 1);
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-test-data").toString("base64") }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await openAIImageGenerate("a blue bicycle", 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].url, `data:image/png;base64,${Buffer.from("png-test-data").toString("base64")}`);
  } finally {
    restoreEnvironment();
  }
});

test("hosted image editing sends validated reference image data", async () => {
  try {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.BOBAI_OPENAI_BASE_URL = "https://api.openai.com/v1";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.openai.com/v1/images/edits");
      assert.ok(init?.body instanceof FormData);
      const form = init.body as FormData;
      assert.equal(form.get("prompt"), "make the background sunny");
      assert.ok(form.get("image[]") instanceof Blob);
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("edited-png").toString("base64") }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const reference = `data:image/png;base64,${Buffer.from("source-png").toString("base64")}`;
    const result = await openAIImageGenerate("make the background sunny", 1, [reference]);
    assert.equal(result.length, 1);
    assert.ok(result[0].url.startsWith("data:image/png;base64,"));
  } finally {
    restoreEnvironment();
  }
});
