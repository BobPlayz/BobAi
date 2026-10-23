import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { cleanTitle } = await import("../src/services/chatTitle.js");
const { buildSystemPrompt, currentDateContext } = await import("../src/services/chatEngine.js");
const { inferRecency, webSearch } = await import("../src/services/research.js");

test("chat titles are three words at most and clean", () => {
  assert.equal(cleanTitle('"Growing Balcony Tomatoes Easily At Home."'), "Growing Balcony Tomatoes");
  assert.equal(cleanTitle("Title: Python List Tricks"), "Python List Tricks");
  assert.equal(cleanTitle("**Maths Help**\nextra line"), "Maths Help");
  assert.equal(cleanTitle("<think>hmm</think>Black Holes"), "Black Holes");
  assert.equal(cleanTitle("  "), "");
  for (const raw of ["one two three four five", "Weather in Hyderabad today", "a b c d"]) assert.ok(cleanTitle(raw).split(" ").length <= 3, raw);
});

test("every prompt tells the model today's date and not to use stale knowledge as current", () => {
  const context = currentDateContext(new Date("2026-10-23T10:00:00Z"));
  assert.match(context, /Friday,? 23 October 2026/);
  assert.match(context, /never answer from memory as if it were current/);
  assert.match(buildSystemPrompt("").content, new RegExp(String(new Date().getUTCFullYear())));
});

test("time-sensitive questions ask for recent results; timeless ones do not", () => {
  assert.equal(inferRecency("india vs australia live score"), "week");
  assert.equal(inferRecency("who won the cricket today"), "week");
  assert.equal(inferRecency("latest iphone price"), "month");
  assert.equal(inferRecency("ipl standings"), "month");
  assert.equal(inferRecency("how does photosynthesis work"), undefined);
});

test("a live-score search asks DuckDuckGo for past-week pages first", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response('<div class="result"><a class="result__a" href="https://example.com/match">India v Australia</a><a class="result__snippet">India 250/4</a></div>', { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
  const savedBrave = process.env.BOBAI_BRAVE_SEARCH_API_KEY;
  delete process.env.BOBAI_BRAVE_SEARCH_API_KEY;
  try {
    await webSearch(`freshness test ${Date.now()} live score`);
    assert.ok(urls[0].includes("html.duckduckgo.com"));
    assert.ok(urls[0].includes("&df=w"), urls[0]);
  } finally {
    globalThis.fetch = original;
    if (savedBrave !== undefined) process.env.BOBAI_BRAVE_SEARCH_API_KEY = savedBrave;
  }
});

test("scores are pulled out of search result titles and snippets, dates are not", async () => {
  const { extractScores } = await import("../src/services/liveData.js");
  const found = extractScores([
    { title: "India 230/6 in 19.4 Overs | New Zealand vs India Live Cricket Score", url: "https://www.news18.com/cricket/live" },
    { title: "Match preview 10/22 schedule", url: "https://example.com/preview" },
    { snippet: "Australia 187 all out, India need 45 runs", url: "https://espncricinfo.com/x" },
    { title: "Pakistan 145/3 (16.2 ov)", url: "https://cricbuzz.com/y" },
  ]);
  assert.deepEqual(found.map((item) => item.source), ["news18.com", "cricbuzz.com"]);
  assert.match(found[0].text, /230\/6 in 19\.4 Overs/);
});
