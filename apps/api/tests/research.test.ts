import assert from "node:assert/strict";
import test from "node:test";
import { matchesSourceTypes, sourceSearchQuery, sourceTypesFrom, type ResearchSource } from "../src/services/research.js";

const source = (url: string): ResearchSource => ({ title: "Example", url });

test("research source preferences normalize supported values and ignore invalid entries", () => {
  assert.deepEqual(sourceTypesFrom({ sourceTypes: ["official", "news", "official", "unknown", 12] }), ["official", "news"]);
  assert.deepEqual(sourceTypesFrom({ sourceTypes: "official" }), []);
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
