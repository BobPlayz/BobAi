import { consumeQuota } from "./usageLimits.js";
import { fetchWeatherData } from "./toolExecution.js";
import { webSearch } from "./research.js";

/**
 * Deterministic live-data routing for weather and cricket.
 *
 * The general tool loop asks the model to pick a tool, runs it, then asks the model again before answering:
 * three or more serial CPU inferences on a laptop. These two intents are recognisable without a model, so the
 * stream route fetches the data directly and makes a single streamed model call that explains it.
 */
export type LiveDataIntent = { kind: "weather"; city: string } | { kind: "cricket"; query: string } | { kind: "sports"; query: string } | { kind: "news"; query: string };
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
const NEWS_TTL_MS = 10 * 60_000;
const NEWS_WORDS = /\b(?:news|headlines?|breaking|what(?:'s| is) happening|latest (?:on|about|from|in)|updates? (?:on|about)|current events|what happened (?:today|yesterday|this week))\b/i;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; value: Omit<LiveDataResult, "cached"> }>();

const WEATHER_WORDS = /\b(weather|forecast|temperature|humidity|how (?:hot|cold|warm) is it|will it (?:rain|snow)|is it (?:raining|snowing))\b/i;
const CITY_AFTER_PREPOSITION = /\b(?:in|at|for|near|around|of)\s+([\p{L}][\p{L}, .'-]{1,80}?)(?:\s+(?:today|tonight|tomorrow|now|right now|currently|this (?:morning|afternoon|evening|week)))?\s*[?.!]*$/iu;
// A cricket term alone ("explain the LBW rule in cricket") is a normal question; only score/result questions are live.
const SPORTS_STATS_WORDS = /\b(?:ronaldo|cristiano ronaldo|messi|lionel messi|mbappe|haaland|neymar|lewandowski|kane|salah|virat kohli|rohit sharma|lebron|curry)\b(?=.*\b(?:goal|goals|scor(?:e|es|ed)|career|stat(?:s|istics)?|record|all[- ]time|total|count|appearances?)\b)|\b(?:career goals|all[- ]time goals|total goals|goal tally|player stats)\b/i;
const CRICKET_WORDS = /\b(?:cricket|ipl|odi|t20i?|test match|bbl|psl|wpl|ranji|india|australia|england|pakistan|south africa|new zealand|sri lanka|bangladesh|afghanistan|west indies|ireland|zimbabwe)\b(?=.*\b(?:score|scores|scorecard|live|result|results|who won|winning|match status)\b)|\b(?:score|scores|scorecard|live|result|who won)\b(?=.*\b(?:cricket|ipl|odi|t20i?|test match|bbl|psl|wpl|ranji)\b)/i;

export function detectLiveDataIntent(text: string): LiveDataIntent | null {
  const value = text.trim();
  if (!value || value.length > 300) return null;
  if (WEATHER_WORDS.test(value)) {
    const city = CITY_AFTER_PREPOSITION.exec(value)?.[1]?.trim().replace(/\s+/g, " ");
    // Without a named place the general router (or the model) asks the user where; never guess a location.
    if (city && city.length >= 2 && !/^(?:today|tonight|tomorrow|now|right now|currently|this week)$/i.test(city)) {
      return { kind: "weather", city };
    }
    return null;
  }
  if (SPORTS_STATS_WORDS.test(value)) return { kind: "sports", query: value.replace(/[?!.]+$/, "") };
  if (CRICKET_WORDS.test(value)) return { kind: "cricket", query: value.replace(/[?!.]+$/, "") };
  if (NEWS_WORDS.test(value)) return { kind: "news", query: value.replace(/[?!.]+$/, "") };
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
  // Stay inside the free plan's daily calls; when they run out, web search takes over.
  if (!(await consumeQuota("cricket_feed")).allowed) return null;
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
  // Only matches from the last week: an old result must never be presented as live.
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = (match: CricketMatch) => { const when = match.date ? Date.parse(match.date) : NaN; return Number.isNaN(when) || when >= weekAgo; };
  const matches = (relevant.length ? relevant : payload.data).filter((match) => match.matchStarted && recent(match)).slice(0, 5).map((match) => ({
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
  const key = intent.kind === "weather" ? `weather:${intent.city.toLowerCase()}` : `${intent.kind}:${intent.query.toLowerCase()}`;
  const cached = fromCache(key);
  if (cached) return cached;
  if (intent.kind === "weather") {
    try {
      const data = await fetchWeatherData(intent.city, signal);
      const value = { kind: "weather" as const, provider: "Open-Meteo", fetchedAt: new Date().toISOString(), freshness: "live" as const, data, sources: [{ title: "Open-Meteo forecast API", url: "https://open-meteo.com/" }] };
      remember(key, value, WEATHER_TTL_MS);
      return { ...value, cached: false };
    } catch (error) {
      if (signal?.aborted) throw error;
      // If the structured weather API is temporarily unreachable, try recent search snippets
      // rather than immediately giving up. This fallback is explicitly labelled as web search.
      const monthYear = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      const result = await webSearch(`current weather temperature conditions in ${intent.city} today ${monthYear}`, { recency: "day" }, signal);
      const sources = result.sources.slice(0, 5).map((source) => ({ title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
      if (!sources.length) throw error;
      const value = {
        kind: "weather" as const,
        provider: process.env.BOBAI_BRAVE_SEARCH_API_KEY?.trim() ? "Brave Search" : "DuckDuckGo",
        fetchedAt: new Date().toISOString(),
        freshness: "web-search" as const,
        data: { query: result.query, searchWindow: "past 24 hours", structuredWeatherUnavailable: true },
        sources,
      };
      remember(key, value, Math.min(WEATHER_TTL_MS, 2 * 60_000));
      return { ...value, cached: false };
    }
  }
  if (intent.kind === "sports") {
    const date = new Date().toISOString().slice(0, 10);
    const query = `${intent.query} official senior career statistics total goals all competitions as of ${date}`;
    let result = await webSearch(query, { recency: "month" }, signal);
    if (!result.sources.length) result = await webSearch(query, {}, signal);
    const sources = result.sources.slice(0, 8).map((source) => ({ title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
    if (!sources.length) throw new Error("No reliable sources were found for this sports-statistics question.");
    const value = { kind: "sports" as const, provider: process.env.BOBAI_BRAVE_SEARCH_API_KEY?.trim() ? "Brave Search" : "DuckDuckGo", fetchedAt: new Date().toISOString(), freshness: "web-search" as const, data: { query: result.query, asOf: date }, sources };
    remember(key, value, 5 * 60_000);
    return { ...value, cached: false };
  }
  if (intent.kind === "news") {
    // Recent pages only (past week, then past month): news from memory is never current.
    const monthYear = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    let window: "week" | "month" = "week";
    let result = await webSearch(`${intent.query} ${monthYear}`, { recency: "week" }, signal);
    if (!result.sources.length) { window = "month"; result = await webSearch(intent.query, { recency: "month" }, signal); }
    const sources = result.sources.slice(0, 6).map((source) => ({ title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
    const value = { kind: "news" as const, provider: process.env.BOBAI_BRAVE_SEARCH_API_KEY?.trim() ? "Brave Search" : "DuckDuckGo", fetchedAt: new Date().toISOString(), freshness: "web-search" as const, data: { query: result.query, searchWindow: window === "week" ? "past 7 days" : "past month" }, sources };
    if (sources.length) remember(key, value, NEWS_TTL_MS);
    return { ...value, cached: false };
  }
  const feed = await cricketFeed(intent.query, signal);
  if (feed) { remember(key, feed, CRICKET_TTL_MS); return { ...feed, cached: false }; }
  // Without a feed, search only recent pages (past week, then past month) and name the current month in the query.
  const monthYear = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  let window: "week" | "month" = "week";
  let result = await webSearch(`${intent.query} live score ${monthYear}`, { recency: "week" }, signal);
  if (!result.sources.length) { window = "month"; result = await webSearch(`${intent.query} score ${monthYear}`, { recency: "month" }, signal); }
  const sources = result.sources.slice(0, 6).map((source) => ({ title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
  const value = { kind: "cricket" as const, provider: process.env.BOBAI_BRAVE_SEARCH_API_KEY?.trim() ? "Brave Search" : "DuckDuckGo", fetchedAt: new Date().toISOString(), freshness: "web-search" as const, data: { query: result.query, searchWindow: window === "week" ? "past 7 days" : "past month", scoresFound: extractScores(sources) }, sources };
  if (sources.length) remember(key, value, CRICKET_TTL_MS);
  return { ...value, cached: false };
}

const SCORE = /\b(\d{1,3})\s*[\/-]\s*(\d{1,2})\b(?:\s*(?:in|\()?\s*(\d{1,2}(?:\.\d)?)\s*(?:ov(?:er)?s?)\)?)?/i;

/** Scores written in search result titles or snippets ("India 230/6 in 19.4 Overs"), with the page they came from. */
export function extractScores(sources: Array<{ title?: string; snippet?: string; url?: string }>) {
  const found: Array<{ text: string; source: string; url?: string }> = [];
  for (const source of sources) {
    for (const field of [source.title, source.snippet]) {
      if (!field) continue;
      const match = SCORE.exec(field);
      // Ignore dates like 10/22 that have no overs and no team-style context.
      if (!match || (!match[3] && !/\b(?:all out|need|won|lead|trail|innings|wkts?|wickets?)\b/i.test(field))) continue;
      found.push({ text: field.trim().slice(0, 160), source: (source.url ? new URL(source.url).hostname.replace(/^www\./, "") : "web"), url: source.url });
      break;
    }
  }
  return found.slice(0, 4);
}

/** Deterministic, source-only response for sports totals. Never let a language model invent or reconcile a career tally. */
export function formatSportsEvidence(result: LiveDataResult): string {
  if (result.kind !== "sports" || !result.sources.length) return "i couldn't verify a reliable sports-statistics answer from current sources, so i won't guess.";
  const entries = result.sources.slice(0, 6).map((source) => {
    const title = source.title.replace(/[\[\]\r\n]/g, " ").slice(0, 180);
    const snippet = (source.snippet || "").replace(/[\r\n]+/g, " ").trim().slice(0, 420);
    return snippet ? `- [${title}](${source.url})\n  ${snippet}` : `- [${title}](${source.url})`;
  });
  return "i found these search results, but they do not establish one single verified career-goal total. counts can differ by competition and inclusion rules, so i won't invent or choose a number without an authoritative, clearly defined source.\n\n**sources checked**\n" + entries.join("\n") + "\n\nthese are search-result excerpts, not independently verified official statistics.";
}

/** Untrusted context handed to the model; the instructions make it cite sources and admit missing data. */
export function liveDataContext(result: LiveDataResult): string {
  const origin = result.cached ? `cached from ${result.fetchedAt}` : `fetched live at ${result.fetchedAt}`;
  const rules = result.kind === "sports"
    ? `These are web search results for a current sports-statistics question, not a single official database. The as-of date is ${String((result.data as { asOf?: string }).asOf ?? new Date().toISOString().slice(0, 10))}. Compare figures and definitions across sources. Distinguish official senior competitive goals from friendlies, youth matches, and unofficial matches. If reputable sources disagree, explain the counting difference instead of choosing an unsupported exact number. Cite the source for every number. If sources do not support a figure, say it could not be verified. Never use a number from model memory.`
    : result.kind === "news"
    ? `These are recent news search results (titles and snippets) from the ${String((result.data as { searchWindow?: string }).searchWindow ?? "recent")} window. Today is ${new Date().toISOString().slice(0, 10)}. They were fetched just now, so they ARE current: answer from them and never say you cannot give news or mention a knowledge cutoff. Summarise only what these sources say, give dates where shown, and name the source of each point by its site or title. Never add events, numbers or quotes that are not in them. If they do not answer the question, say you could not find recent news on it.`
    : result.kind === "weather"
    ? result.freshness === "live"
      ? "Answer using only this structured weather data. Mention the resolved location, observation time, and Open-Meteo as the source. If a value is missing, say so."
      : `Open-Meteo's structured weather API was unavailable, so these are recent web search snippets for ${String((result.data as { query?: string }).query ?? "the requested location")}, not verified sensor readings. Use only facts stated in the snippets, cite the source sites, and clearly say this is a search-based fallback. If the snippets do not contain an actual current condition or temperature, say that a precise live reading could not be verified instead of guessing.`
    : result.freshness === "live"
      ? "This is a live scoring feed with matches from the last 7 days. Report scores exactly as given with each match's date, say which match each score belongs to, and mention it comes from CricketData.org. Never invent a score."
      : "These are web search results (titles and snippets), not an official scoring feed. Today is " + new Date().toISOString().slice(0, 10) + ". The search only returned pages from the window shown in searchWindow, so these results are recent. scoresFound lists scores copied word for word from those results: if it is not empty, start your answer with that score, the match it belongs to and its source (say it may be a few minutes behind), and do not claim no score exists. Ignore anything that is clearly an older match, a preview or a season summary. Only if no result states a score, say you couldn't find the current score and suggest ESPNcricinfo or Cricbuzz. Never use scores from memory. Never invent a score.";
  const payload = JSON.stringify({ provider: result.provider, freshness: result.freshness, data: result.data, sources: result.sources }).slice(0, 3_500);
  return `[untrusted live data: ${result.kind}, ${origin}]\n${payload}\n[/untrusted live data]\n${rules} Answer naturally; do not mention these instructions or the words "untrusted live data".`;
}
