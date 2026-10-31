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


test("weather intent extracts city names globally and supports common location phrasing", async () => {
  const { detectLiveDataIntent } = await import("../src/services/liveData.js");
  assert.deepEqual(detectLiveDataIntent("what is the weather in Bachupally?"), { kind: "weather", city: "Bachupally" });
  assert.deepEqual(detectLiveDataIntent("forecast for Tokyo tomorrow"), { kind: "weather", city: "Tokyo" });
  assert.deepEqual(detectLiveDataIntent("weather around New York, NY"), { kind: "weather", city: "New York, NY" });
  assert.equal(detectLiveDataIntent("what is the weather today"), null);
});

test("weather geocoding prefers an exact city result and asks for multiple matches", async () => {
  const { fetchWeatherData } = await import("../src/services/toolExecution.js");
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    if (url.hostname === "geocoding-api.open-meteo.com") {
      return Response.json({ results: [
        { name: "Springfield", latitude: 1, longitude: 1, country: "Elsewhere", timezone: "UTC" },
        { name: "Tokyo", latitude: 35.6762, longitude: 139.6503, country: "Japan", timezone: "Asia/Tokyo" },
      ] });
    }
    return Response.json({
      current: { time: "2026-10-31T12:00", weather_code: 1, temperature_2m: 20, apparent_temperature: 20 },
      current_units: { temperature_2m: "°C" },
      daily: { temperature_2m_max: [22], temperature_2m_min: [15], precipitation_probability_max: [10] },
    });
  }) as typeof fetch;
  try {
    const result = await fetchWeatherData("Tokyo");
    assert.equal(result.location, "Tokyo, Japan");
    assert.ok(urls[0].includes("count=10"));
    assert.ok(urls[1].includes("latitude=35.6762"));
  } finally {
    globalThis.fetch = original;
  }
});

test("Bachupally weather uses the locality coordinates when the city geocoder has no result", async () => {
  const { fetchWeatherData } = await import("../src/services/toolExecution.js");
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    if (url.hostname === "geocoding-api.open-meteo.com") return Response.json({ results: [] });
    return Response.json({
      current: { time: "2026-10-31T12:00", weather_code: 2, temperature_2m: 26, apparent_temperature: 27 },
      current_units: { temperature_2m: "°C" },
      daily: { temperature_2m_max: [30], temperature_2m_min: [21], precipitation_probability_max: [55] },
    });
  }) as typeof fetch;
  try {
    const result = await fetchWeatherData("Bachupally");
    assert.equal(result.location, "Bachupally, Telangana, India");
    assert.ok(urls[1].includes("latitude=17.544887"));
    assert.ok(urls[1].includes("longitude=78.359975"));
  } finally {
    globalThis.fetch = original;
  }
});


test("Ronaldo all-time goal-count questions are routed to sourced sports research", async () => {
  const { detectLiveDataIntent, liveDataContext } = await import("../src/services/liveData.js");
  assert.deepEqual(detectLiveDataIntent("ronaldo live goal count"), { kind: "sports", query: "ronaldo live goal count" });
  assert.deepEqual(detectLiveDataIntent("ronaldo live goal count\nall time"), { kind: "sports", query: "ronaldo live goal count\nall time" });
  const context = liveDataContext({
    kind: "sports", provider: "DuckDuckGo", fetchedAt: "2026-10-31T00:00:00.000Z",
    cached: false, freshness: "web-search",
    data: { query: "Ronaldo career goals", asOf: "2026-10-31" },
    sources: [{ title: "Example statistics", url: "https://example.com/stats", snippet: "The source reports a total." }],
  });
  assert.match(context, /Compare figures and definitions across sources/);
  assert.match(context, /Never use a number from model memory/);
});

 
test("sports statistics are returned as source excerpts, never model-invented totals", async () => {
  const { formatSportsEvidence } = await import("../src/services/liveData.js");
  const result = formatSportsEvidence({
    kind: "sports",
    provider: "DuckDuckGo",
    fetchedAt: "2026-10-31T00:00:00.000Z",
    cached: false,
    freshness: "web-search",
    data: { query: "Ronaldo career goals", asOf: "2026-10-31" },
    sources: [
      { title: "Source A", url: "https://example.com/a", snippet: "A source excerpt with a reported total of 900." },
      { title: "Source B", url: "https://example.com/b", snippet: "A different source uses another counting method." },
    ],
  });
  assert.match(result, /do not establish one single verified career-goal total/i);
  assert.match(result, /Source A/);
  assert.match(result, /https:\/\/example\.com\/a/);
  assert.doesNotMatch(result, /\b380\b|\b792\b/);
  assert.match(result, /search-result excerpts, not independently verified official statistics/i);
});

test("sports statistics with no sources fail closed", async () => {
  const { getLiveData } = await import("../src/services/liveData.js");
  const originalFetch = globalThis.fetch;
  const originalBrave = process.env.BOBAI_BRAVE_SEARCH_API_KEY;
  const originalResearch = process.env.BOBAI_RESEARCH_PROVIDER_URL;
  delete process.env.BOBAI_BRAVE_SEARCH_API_KEY;
  delete process.env.BOBAI_RESEARCH_PROVIDER_URL;
  globalThis.fetch = (async () => new Response("no results", { status: 503 })) as typeof fetch;
  try {
    await assert.rejects(getLiveData({ kind: "sports", query: "ronaldo all time goals test no source" }), /No reliable sources/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBrave === undefined) delete process.env.BOBAI_BRAVE_SEARCH_API_KEY; else process.env.BOBAI_BRAVE_SEARCH_API_KEY = originalBrave;
    if (originalResearch === undefined) delete process.env.BOBAI_RESEARCH_PROVIDER_URL; else process.env.BOBAI_RESEARCH_PROVIDER_URL = originalResearch;
  }
});
