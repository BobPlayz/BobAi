const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 2_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 2 * 60_000;
const CACHE_MAX = 500;
type CacheEntry = { expiresAt: number; result: ResearchResult };
const cache = new Map<string, CacheEntry>();

function getProvider() {
  const configured = process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim();
  if (!configured) throw new Error("web search provider is not configured");
  const url = new URL(configured);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback)) throw new Error("web search provider must use HTTPS outside local development");
  return url.toString().replace(/\/$/, "");
}
function getTimeoutMs() { const configured = Number(process.env.BOBAI_RESEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS); return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), 120_000) : DEFAULT_TIMEOUT_MS; }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export type ResearchSource = { title: string; url: string; snippet?: string; publishedAt?: string; score?: number; credibility?: "high" | "medium" | "low" };
export type ResearchResult = { query: string; sources: ResearchSource[] };

function domainCredibility(hostname: string): { score: number; credibility: ResearchSource["credibility"] } {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith(".gov") || host.endsWith(".gov.in") || host.endsWith(".edu") || host.endsWith(".ac.in") || host.endsWith(".int")) return { score: 1, credibility: "high" };
  if (host === "who.int" || host === "un.org" || host === "nasa.gov" || host === "nih.gov" || host === "nature.com" || host === "science.org") return { score: 1, credibility: "high" };
  if (host.endsWith("reuters.com") || host.endsWith("apnews.com") || host.endsWith("bbc.com")) return { score: 0.85, credibility: "high" };
  if (host.endsWith("wikipedia.org") || host.endsWith("britannica.com")) return { score: 0.65, credibility: "medium" };
  return { score: 0.45, credibility: "low" };
}
function queryTerms(query: string) { return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3))].slice(0, 40); }
function rankSources(query: string, sources: ResearchSource[]) {
  const terms = queryTerms(query);
  return sources.map((source) => {
    const text = `${source.title} ${source.snippet || ""}`.toLowerCase();
    const matched = terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
    const relevance = terms.length ? matched / terms.length : 0;
    let freshness = 0;
    if (source.publishedAt) { const timestamp = Date.parse(source.publishedAt); if (Number.isFinite(timestamp)) freshness = Math.max(0, 1 - Math.min(1, Math.abs(Date.now() - timestamp) / (365 * 24 * 60 * 60 * 1000))); }
    let credibility = { score: 0.45, credibility: "low" as ResearchSource["credibility"] };
    try { credibility = domainCredibility(new URL(source.url).hostname); } catch {}
    const score = Number((relevance * 0.55 + freshness * 0.15 + credibility.score * 0.30).toFixed(4));
    return { ...source, score, credibility: credibility.credibility };
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}
function normalizeSources(body: unknown, query: string): ResearchSource[] {
  const candidate = body && typeof body === "object" ? (body as Record<string, unknown>).results ?? (body as Record<string, unknown>).sources : undefined;
  if (!Array.isArray(candidate)) return [];
  const seen = new Set<string>(); const sources: ResearchSource[] = [];
  for (const item of candidate) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>; const url = typeof value.url === "string" ? value.url.trim() : typeof value.link === "string" ? value.link.trim() : "";
    if (!url) continue;
    try {
      const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) continue; parsed.hash = ""; const canonical = parsed.toString();
      const dedupeKey = `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`; if (seen.has(dedupeKey)) continue; seen.add(dedupeKey);
      sources.push({ title: typeof value.title === "string" ? value.title.slice(0, 500) : canonical, url: canonical, snippet: typeof value.snippet === "string" ? value.snippet.slice(0, 3000) : typeof value.description === "string" ? value.description.slice(0, 3000) : undefined, publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : undefined });
    } catch { /* ignore malformed provider URLs */ }
  }
  return rankSources(query, sources).slice(0, 50);
}

function cacheKey(query: string, options: Record<string, unknown>) { return JSON.stringify([query, Object.keys(options).sort().reduce((out, key) => { out[key] = options[key]; return out; }, {} as Record<string, unknown>)]); }
function getCached(key: string) { const value = cache.get(key); if (!value) return null; if (value.expiresAt <= Date.now()) { cache.delete(key); return null; } return value.result; }
function putCached(key: string, result: ResearchResult) { if (cache.size >= CACHE_MAX) { const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]; if (oldest) cache.delete(oldest[0]); } cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result }); }

export async function webSearch(query: string, options: Record<string, unknown> = {}): Promise<ResearchResult> {
  const normalized = query.trim(); if (!normalized) throw new Error("search query is required"); if (normalized.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");
  const key = cacheKey(normalized, options); const cached = getCached(key); if (cached) return cached;
  const headers: Record<string, string> = { "content-type": "application/json" }; const providerKey = process.env.BOBAI_RESEARCH_PROVIDER_KEY?.trim(); if (providerKey) headers.authorization = `Bearer ${providerKey}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), getTimeoutMs());
    try {
      const response = await fetch(getProvider(), { method: "POST", headers, body: JSON.stringify({ query: normalized, ...options }), signal: controller.signal, redirect: "error" });
      const contentLength = Number(response.headers.get("content-length")); if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      const text = await response.text(); if (text.length > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      if (!response.ok) { if (attempt < MAX_RETRIES && (response.status === 408 || response.status === 429 || response.status >= 500)) { await sleep(250 * 2 ** attempt); continue; } throw new Error(`web search provider returned ${response.status}`); }
      let body: unknown = {}; if (text.trim()) { try { body = JSON.parse(text); } catch { body = { data: text }; } }
      const result = { query: normalized, sources: normalizeSources(body, normalized) }; putCached(key, result); return result;
    } finally { clearTimeout(timer); }
  }
  throw new Error("web search provider unavailable");
}
