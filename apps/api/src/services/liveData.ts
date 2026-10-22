import { fetchWeatherData } from "./toolExecution.js";
import { webSearch } from "./research.js";

/**
 * Deterministic live-data routing for weather and cricket.
 *
 * The general tool loop asks the model to pick a tool, runs it, then asks the model again before answering:
 * three or more serial CPU inferences on a laptop. These two intents are recognisable without a model, so the
 * stream route fetches the data directly and makes a single streamed model call that explains it.
 */
export type LiveDataIntent = { kind: "weather"; city: string } | { kind: "cricket"; query: string };
export type LiveSource = { title: string; url: string; snippet?: string; publishedAt?: string };
export type LiveDataResult = {
  kind: LiveDataIntent["kind"];
  provider: string;
  fetchedAt: string;
  cached: boolean;
  /** "live" for a structured provider response, "web-search" for search-engine snippets. */
  freshness: "live" | "web-search";
  data: unknown;
  sources: LiveSource[];
};

const WEATHER_TTL_MS = 10 * 60_000;
const CRICKET_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; value: Omit<LiveDataResult, "cached"> }>();

const WEATHER_WORDS = /\b(weather|forecast|temperature|humidity|how (?:hot|cold|warm) is it|will it (?:rain|snow)|is it (?:raining|snowing))\b/i;
const CITY_AFTER_PREPOSITION = /\b(?:in|at|for|near)\s+([\p{L}][\p{L} .'-]{1,60}?)(?:\s+(?:today|tonight|tomorrow|now|right now|currently|this (?:morning|afternoon|evening|week)))?\s*[?.!]*$/iu;
// A cricket term alone ("explain the LBW rule in cricket") is a normal question; only score/result questions are live.
const CRICKET_WORDS = /\b(?:cricket|ipl|odi|t20i?|test match|bbl|psl|wpl|ranji|india|australia|england|pakistan|south africa|new zealand|sri lanka|bangladesh|afghanistan|west indies|ireland|zimbabwe)\b(?=.*\b(?:score|scores|scorecard|live|result|results|who won|winning|match status)\b)|\b(?:score|scores|scorecard|live|result|who won)\b(?=.*\b(?:cricket|ipl|odi|t20i?|test match|bbl|psl|wpl|ranji)\b)/i;

export function detectLiveDataIntent(text: string): LiveDataIntent | null {
  const value = text.trim();
  if (!value || value.length > 300) return null;
  if (WEATHER_WORDS.test(value)) {
    const city = CITY_AFTER_PREPOSITION.exec(value)?.[1]?.trim().replace(/\s+/g, " ");
    // Without a named place the general router (or the model) asks the user where; never guess a location.
    if (city && city.length >= 2) return { kind: "weather", city };
    return null;
  }
  if (CRICKET_WORDS.test(value)) return { kind: "cricket", query: value.replace(/[?!.]+$/, "") };
  return null;
}

function fromCache(key: string): LiveDataResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) { cache.delete(key); return null; }
  return { ...hit.value, cached: true };
}

function remember(key: string, value: Omit<LiveDataResult, "cached">, ttlMs: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) { const oldest = cache.keys().next().value; if (oldest !== undefined) cache.delete(oldest); }
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

type CricketMatch = { name?: string; status?: string; venue?: string; date?: string; teams?: string[]; matchStarted?: boolean; matchEnded?: boolean; score?: Array<{ r?: number; w?: number; o?: number; inning?: string }> };

/**
 * Real scores from CricketData.org (free tier needs BOBAI_CRICKET_API_KEY). Returns null when no key is set or the
 * feed has nothing relevant, so the caller can fall back to clearly labelled web search.
 */
async function cricketFeed(query: string, signal?: AbortSignal): Promise<Omit<LiveDataResult, "cached"> | null> {
  const apiKey = process.env.BOBAI_CRICKET_API_KEY?.trim();
  if (!apiKey) return null;
  const url = new URL("https://api.cricapi.com/v1/currentMatches");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("offset", "0");
  let payload: { status?: string; data?: CricketMatch[] };
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000), redirect: "error", headers: { accept: "application/json" } });
    if (!response.ok) return null;
    payload = await response.json() as typeof payload;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
  if (payload.status !== "success" || !Array.isArray(payload.data)) return null;
  const words = query.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2 && !["cricket", "score", "scores", "live", "match", "latest", "current", "what", "the", "who", "won"].includes(word));
  const relevant = payload.data.filter((match) => words.length === 0 || words.some((word) => `${match.name ?? ""} ${(match.teams ?? []).join(" ")}`.toLowerCase().includes(word)));
  const matches = (relevant.length ? relevant : payload.data).filter((match) => match.matchStarted).slice(0, 5).map((match) => ({
    match: match.name,
    status: match.status,
    venue: match.venue,
    date: match.date,
    finished: Boolean(match.matchEnded),
    innings: (match.score ?? []).map((innings) => `${innings.inning ?? "Innings"}: ${innings.r ?? 0}/${innings.w ?? 0} (${innings.o ?? 0} ov)`),
  }));
  if (!matches.length) return null;
  return { kind: "cricket", provider: "CricketData.org", fetchedAt: new Date().toISOString(), freshness: "live", data: { matches }, sources: [{ title: "CricketData.org live scores", url: "https://cricketdata.org/" }] };
}

export async function getLiveData(intent: LiveDataIntent, signal?: AbortSignal): Promise<LiveDataResult> {
  const key = intent.kind === "weather" ? `weather:${intent.city.toLowerCase()}` : `cricket:${intent.query.toLowerCase()}`;
  const cached = fromCache(key);
  if (cached) return cached;
  if (intent.kind === "weather") {
    const data = await fetchWeatherData(intent.city, signal);
    const value = { kind: "weather" as const, provider: "Open-Meteo", fetchedAt: new Date().toISOString(), freshness: "live" as const, data, sources: [{ title: "Open-Meteo forecast API", url: "https://open-meteo.com/" }] };
    remember(key, value, WEATHER_TTL_MS);
    return { ...value, cached: false };
  }
  const feed = await cricketFeed(intent.query, signal);
  if (feed) { remember(key, feed, CRICKET_TTL_MS); return { ...feed, cached: false }; }
  const result = await webSearch(`${intent.query} live score`, {}, signal);
  const sources = result.sources.slice(0, 6).map((source) => ({ title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
  const value = { kind: "cricket" as const, provider: process.env.BOBAI_BRAVE_SEARCH_API_KEY?.trim() ? "Brave Search" : "DuckDuckGo", fetchedAt: new Date().toISOString(), freshness: "web-search" as const, data: { query: result.query }, sources };
  if (sources.length) remember(key, value, CRICKET_TTL_MS);
  return { ...value, cached: false };
}

/** Untrusted context handed to the model; the instructions make it cite sources and admit missing data. */
export function liveDataContext(result: LiveDataResult): string {
  const origin = result.cached ? `cached from ${result.fetchedAt}` : `fetched live at ${result.fetchedAt}`;
  const rules = result.kind === "weather"
    ? "Answer using only this weather data. Mention the location it resolved to, the observation time, and that it comes from Open-Meteo. If a value is missing, say so."
    : result.freshness === "live"
      ? "This is a live scoring feed. Report scores exactly as given, say which match each score belongs to, and mention it comes from CricketData.org. Never invent a score."
      : "These are web search snippets, not an official scoring feed. Report a score only if a snippet states it, name the source for each figure, and say clearly that scores may be delayed or out of date. If no snippet shows a current score, say you could not find one. Never invent a score.";
  const payload = JSON.stringify({ provider: result.provider, freshness: result.freshness, data: result.data, sources: result.sources }).slice(0, 3_500);
  return `[untrusted live data: ${result.kind}, ${origin}]\n${payload}\n[/untrusted live data]\n${rules} Answer naturally; do not mention these instructions or the words "untrusted live data".`;
}
