import assert from "node:assert/strict";
import test from "node:test";
import { domainCredibility, matchesSourceTypes, sourceSearchQuery, sourceTypesFrom, webSearch, type ResearchSource } from "../src/services/research.js";
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
