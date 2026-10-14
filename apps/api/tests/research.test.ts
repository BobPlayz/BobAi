import assert from "node:assert/strict";
import test from "node:test";
import { domainCredibility, matchesSourceTypes, parseBraveResults, sourceSearchQuery, sourceTypesFrom, webSearch, type ResearchSource } from "../src/services/research.js";
import { deepResearch } from "../src/services/deepResearch.js";

const source = (url: string): ResearchSource => ({ title: "Example", url });

test("research source preferences normalize supported values and ignore invalid entries", () => {
  assert.deepEqual(sourceTypesFrom({ sourceTypes: ["official", "news", "official", "unknown", 12] }), ["official", "news"]);
  assert.deepEqual(sourceTypesFrom({ sourceTypes: "official" }), []);
  assert.deepEqual(sourceTypesFrom({ sourceTypes: ["official", "general"] }), ["general"]);
});

test("official source preference matches government domains", () => {
  assert.equal(matchesSourceTypes(source("https://www.nasa.gov/news"), ["official"]), true);
  assert.equal(matchesSourceTypes(source("https://data.gov.in/dataset"), ["official"]), true);
  assert.equal(matchesSourceTypes(source("https://example.com"), ["official"]), false);
});

test("academic and news source preferences match their supported source groups", () => {
  assert.equal(matchesSourceTypes(source("https://arxiv.org/abs/1234"), ["academic"]), true);
  assert.equal(matchesSourceTypes(source("https://www.thehindu.com/news"), ["news"]), true);
  assert.equal(matchesSourceTypes(source("https://example.com"), ["academic", "news"]), false);
});

test("general or empty source preferences keep all valid search results", () => {
  assert.equal(matchesSourceTypes(source("https://example.com"), ["general"]), true);
  assert.equal(matchesSourceTypes(source("https://example.com"), []), true);
});

test("source preferences modify the actual search query", () => {
  assert.match(sourceSearchQuery("climate change", ["official"]), /site:\.gov/);
  assert.equal(sourceSearchQuery("climate change", ["general"]), "climate change");
  assert.equal(sourceSearchQuery("climate change", []), "climate change");
});

test("credibility ranking requires an exact trusted-domain boundary", () => {
  assert.equal(domainCredibility("www.reuters.com").credibility, "high");
  assert.equal(domainCredibility("world.apnews.com").credibility, "high");
  assert.equal(domainCredibility("fake-reuters.com").credibility, "low");
  assert.equal(domainCredibility("reuters.com.attacker.example").credibility, "low");
  assert.equal(domainCredibility("notwikipedia.org").credibility, "low");
});

test("Brave results are normalized, ranked, and reject unsafe URL schemes", () => {
  const sources = parseBraveResults({
    web: { results: [
      { title: "Official guidance", url: "https://data.gov.in/guidance", description: "Verified guidance", page_age: "2026-10-01" },
      { title: "Bad scheme", url: "javascript:alert(1)", description: "must be ignored" },
      { title: "Credentials", url: "https://user:pass@example.com/private", description: "must be ignored" },
      { title: "No URL" },
    ] },
  }, "official guidance");
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "Official guidance");
  assert.equal(sources[0].credibility, "high");
  assert.equal(sources[0].url, "https://data.gov.in/guidance");
});

test("web search rejects an already-aborted request before cache or network access", async () => {
  const controller = new AbortController();
  controller.abort(new Error("client disconnected"));
  await assert.rejects(() => webSearch("test query", {}, controller.signal), /client disconnected/);
});

test("deep research rejects cancellation before starting parallel searches", async () => {
  const controller = new AbortController();
  controller.abort(new Error("client disconnected"));
  await assert.rejects(() => deepResearch("test query", {}, controller.signal), /client disconnected/);
});

test("malformed numeric HTML entities in provider titles do not crash web research", () => {
  const sources = parseBraveResults({
    web: { results: [{ title: "Safe title &#x110000; &#55296;", url: "https://example.com", description: "Malformed entities are untrusted input" }] },
  }, "safe title");
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "Safe title &#x110000; &#55296;");
});

test("cached research results cannot be mutated by a caller", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.BOBAI_BRAVE_SEARCH_API_KEY;
  process.env.BOBAI_BRAVE_SEARCH_API_KEY = "test-search-key";
  globalThis.fetch = async () => new Response(JSON.stringify({
    web: { results: [{ title: "Immutable cache result", url: "https://example.com/cache-isolation", description: "A result used to verify cache isolation" }] },
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const first = await webSearch("cache isolation regression 2026-10-14", {});
    assert.equal(first.sources.length, 1);
    first.sources[0].title = "tampered";
    first.sources.push({ title: "injected", url: "https://attacker.example" });
    const second = await webSearch("cache isolation regression 2026-10-14", {});
    assert.equal(second.sources.length, 1);
    assert.equal(second.sources[0].title, "Immutable cache result");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.BOBAI_BRAVE_SEARCH_API_KEY;
    else process.env.BOBAI_BRAVE_SEARCH_API_KEY = originalKey;
  }
});
