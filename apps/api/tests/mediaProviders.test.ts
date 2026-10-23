import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { pollinationsGenerate, pollinationsRetryAfter, pollinationsUrl } = await import("../src/services/pollinations.js");
const { imageProvider } = await import("../src/services/mediaGeneration.js");
const { elevenLabsSynthesize, elevenLabsTranscribe, speakableText, wavSeconds } = await import("../src/services/elevenlabs.js");
const { speechProvider } = await import("../src/services/voice.js");

const KEYS = ["BOBAI_IMAGE_PROVIDER", "BOBAI_IMAGE_MODEL_PATH", "VERCEL", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "BOBAI_TTS_PROVIDER", "POLLINATIONS_API_KEY"] as const;
function withEnv<T>(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => T): T {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  const restore = () => { for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } };
  try { const result = fn(); if (result instanceof Promise) return result.finally(restore) as T; restore(); return result; } catch (error) { restore(); throw error; }
}

test("the hosted site uses Pollinations; a PC with a local model uses it; it can be forced or switched off", () => {
  withEnv({ VERCEL: "1", BOBAI_IMAGE_MODEL_PATH: "/models/tiny-sd" }, () => assert.equal(imageProvider(), "pollinations"));
  withEnv({ BOBAI_IMAGE_MODEL_PATH: "/models/tiny-sd" }, () => assert.equal(imageProvider(), "local"));
  withEnv({}, () => assert.equal(imageProvider(), "pollinations"));
  withEnv({ BOBAI_IMAGE_PROVIDER: "off" }, () => assert.equal(imageProvider(), "off"));
});

test("Pollinations requests are private, safe-filtered and come back as stored images", async () => {
  const url = pollinationsUrl("a red bike on a beach", { width: 512, height: 512, seed: 7 });
  assert.equal(url.origin, "https://image.pollinations.ai");
  assert.equal(url.searchParams.get("private"), "true");
  assert.equal(url.searchParams.get("safe"), "true");
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { headers: { "content-type": "image/jpeg" } })) as typeof fetch;
  try {
    // Keyless: one picture (the free tier allows one every 45 seconds); with a key, as many as asked.
    assert.equal((await pollinationsGenerate("a red bike", 2, undefined, { width: 512, height: 512, seed: 7 })).length, 1);
    const images = await withEnv({ POLLINATIONS_API_KEY: "pk-test" }, () => pollinationsGenerate("a red bike", 2, undefined, { width: 512, height: 512, seed: 7 }));
    assert.equal(images.length, 2);
    assert.match(images[0].url, /^data:image\/jpeg;base64,/);
    assert.deepEqual(images.map((image) => image.seed), [7, 8]);
    globalThis.fetch = (async () => new Response("<html>error</html>", { headers: { "content-type": "text/html" } })) as typeof fetch;
    await assert.rejects(pollinationsGenerate("x", 1, undefined, { width: 512, height: 512 }), /not an image/);
  } finally { globalThis.fetch = original; }
});

test("Pollinations' free limit becomes a short wait or a friendly busy message", async () => {
  const limited = JSON.stringify({ error: { code: "FREE_LIMIT", message: "Free limit reached: 1 image every 45 seconds per IP. Retry after 60s" } });
  assert.equal(pollinationsRetryAfter(402, limited, null), 60);
  assert.equal(pollinationsRetryAfter(429, "", "5"), 5);
  assert.equal(pollinationsRetryAfter(402, "payment required", null), null);
  assert.equal(pollinationsRetryAfter(500, limited, null), null);
  assert.equal(pollinationsRetryAfter(402, "", "19"), 19);
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(limited, { status: 402, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    await assert.rejects(pollinationsGenerate("x", 1, undefined, { width: 512, height: 512 }), /^Error: the image service is busy.*try again in 60 seconds/);
  } finally { globalThis.fetch = original; }
});

test("speech uses ElevenLabs on the hosted site only when a key is set, Piper otherwise", () => {
  withEnv({ VERCEL: "1" }, () => assert.equal(speechProvider(), "local"));
  withEnv({ VERCEL: "1", ELEVENLABS_API_KEY: "test" }, () => assert.equal(speechProvider(), "elevenlabs"));
  withEnv({ ELEVENLABS_API_KEY: "test" }, () => assert.equal(speechProvider(), "local"));
  withEnv({ ELEVENLABS_API_KEY: "test", BOBAI_TTS_PROVIDER: "elevenlabs" }, () => assert.equal(speechProvider(), "elevenlabs"));
});

test("ElevenLabs gets clean text, the key in a header, and the Flash model", async () => {
  assert.equal(speakableText("**Hi** there\n```js\nconst a = 1\n```\nsee [docs](https://x.y)"), "Hi there (code shown on screen) see docs");
  const key = ["el", "test", "key"].join("-");
  await withEnv({ ELEVENLABS_API_KEY: key }, async () => {
    const original = globalThis.fetch;
    let seen: { url: string; headers: Headers; body: { text: string; model_id: string } } | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    try {
      const result = await elevenLabsSynthesize("Hello **world**");
      assert.match(seen!.url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/JBFqnCBsd6RMkjVDRZzb\?output_format=mp3/);
      assert.equal(seen!.headers.get("xi-api-key"), key);
      assert.ok(!seen!.url.includes(key), "the key is never put in the URL");
      assert.deepEqual(seen!.body, { text: "Hello world", model_id: "eleven_flash_v2_5" });
      assert.equal(result.mimeType, "audio/mpeg");
      globalThis.fetch = (async () => new Response("{}", { status: 401 })) as typeof fetch;
      await assert.rejects(elevenLabsSynthesize("hi"), /rejected the API key/);
    } finally { globalThis.fetch = original; }
  });
});

function wav(seconds: number) {
  const data = Math.round(seconds * 32_000);
  const buffer = Buffer.alloc(44 + data);
  buffer.write("RIFF", 0, "ascii"); buffer.writeUInt32LE(36 + data, 4); buffer.write("WAVE", 8, "ascii"); buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(16_000, 24); buffer.writeUInt32LE(32_000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36, "ascii"); buffer.writeUInt32LE(data, 40);
  return buffer;
}

test("ElevenLabs speech-to-text sends a WAV with the key in a header and returns the words", async () => {
  assert.equal(wavSeconds(wav(2.5)), 2.5);
  assert.equal(wavSeconds(Buffer.from("not audio at all, definitely not a wav file header....")), null);
  const key = ["el", "test", "key"].join("-");
  await withEnv({ ELEVENLABS_API_KEY: key }, async () => {
    const original = globalThis.fetch;
    let seen: { url: string; headers: Headers; form: FormData } | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(input), headers: new Headers(init?.headers), form: init?.body as FormData };
      return Response.json({ text: " hey jarvis what's up ", language_code: "en" });
    }) as typeof fetch;
    try {
      const result = await elevenLabsTranscribe(wav(1), "hi");
      assert.equal(result.text, "hey jarvis what's up");
      assert.equal(seen?.url, "https://api.elevenlabs.io/v1/speech-to-text");
      assert.equal(seen?.headers.get("xi-api-key"), key);
      assert.equal(seen?.form.get("model_id"), "scribe_v1");
      assert.equal(seen?.form.get("language_code"), "hi");
      assert.ok(!String(seen?.url).includes(key));
      await elevenLabsTranscribe(wav(1), "x; drop");
      assert.equal(seen?.form.get("language_code"), null);
      globalThis.fetch = (async () => new Response("nope", { status: 401 })) as typeof fetch;
      await assert.rejects(elevenLabsTranscribe(wav(1)), /rejected the API key/);
    } finally { globalThis.fetch = original; }
  });
});
