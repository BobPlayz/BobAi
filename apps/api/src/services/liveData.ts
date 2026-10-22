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

const WEATHER_WORDS = /\b(weather|forecast|temperature|raining|rain|snowing|humid(?:ity)?|how hot|how cold)\b/i;
const CITY_AFTER_PREPOSITION = /\b(?:in|at|for|near)\s+([\p{L}][\p{L} .'-]{1,60}?)(?:\s+(?:today|tonight|tomorrow|now|right now|currently|this (?:morning|afternoon|evening|week)))?\s*[?.!]*$/iu;
const CRICKET_WORDS = /\b(cricket|ipl|odi|t20i?|test match|bbl|psl|wpl|ranji)\b|\b(live|latest|current|last)\s+(?:match\s+)?score\b.*\b(india|australia|england|pakistan|south africa|new zealand|sri lanka|bangladesh|afghanistan|west indies|ireland|zimbabwe)\b/i;

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
    : "These are web search snippets, not an official scoring feed. Report a score only if a snippet states it, name the source for each figure, and say clearly that scores may be delayed or out of date. If no snippet shows a current score, say you could not find one. Never invent a score.";
  const payload = JSON.stringify({ provider: result.provider, freshness: result.freshness, data: result.data, sources: result.sources }).slice(0, 3_500);
  return `[untrusted live data: ${result.kind}, ${origin}]\n${payload}\n[/untrusted live data]\n${rules} Answer naturally; do not mention these instructions or the words "untrusted live data".`;
}
