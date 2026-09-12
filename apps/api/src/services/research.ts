const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 2_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 2 * 60_000;
const CACHE_MAX = 500;

type CacheEntry = { expiresAt: number; result: ResearchResult };
const cache = new Map<string, CacheEntry>();

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
}
function stripTags(value: string) { return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function getTimeoutMs() { const configured = Number(process.env.BOBAI_RESEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS); return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), 120_000) : DEFAULT_TIMEOUT_MS; }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export type ResearchSource = { title: string; url: string; snippet?: string; publishedAt?: string; score?: number; credibility?: "high" | "medium" | "low" };
export type ResearchResult = { query: string; sources: ResearchSource[] };

function domainCredibility(hostname: string): { score: number; credibility: ResearchSource["credibility"] } {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith(".gov") || host.endsWith(".gov.in") || host.endsWith(".edu") || host.endsWith(".ac.in") || host.endsWith(".int")) return { score: 1, credibility: "high" };
  if (["who.int", "un.org", "nasa.gov", "nih.gov", "nature.com", "science.org"].includes(host)) return { score: 1, credibility: "high" };
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
function cacheKey(query: string, options: Record<string, unknown>) { return JSON.stringify([query, Object.keys(options).sort().reduce((out, key) => { out[key] = options[key]; return out; }, {} as Record<string, unknown>)]); }
function getCached(key: string) { const value = cache.get(key); if (!value) return null; if (value.expiresAt <= Date.now()) { cache.delete(key); return null; } return value.result; }
function putCached(key: string, result: ResearchResult) { if (cache.size >= CACHE_MAX) { const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]; if (oldest) cache.delete(oldest[0]); } cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result }); }

function parseDuckDuckGo(html: string, query: string): ResearchSource[] {
  const sources: ResearchSource[] = [];
  const blocks = html.match(/<div[^>]+class=["'][^"']*result[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi) || [];
  for (const block of blocks) {
    const link = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    let url = link[1];
    try { if (url.startsWith("//")) url = `https:${url}`; const parsed = new URL(url, "https://duckduckgo.com"); const uddg = parsed.searchParams.get("uddg"); if (uddg) url = uddg; else if (!/^https?:$/i.test(parsed.protocol)) continue; } catch { continue; }
    const snippetMatch = block.match(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    sources.push({ title: stripTags(link[2]).slice(0, 500), url, snippet: snippetMatch ? stripTags(snippetMatch[1]).slice(0, 3000) : undefined });
    if (sources.length >= 50) break;
  }
  return rankSources(query, sources);
}

export async function webSearch(query: string, options: Record<string, unknown> = {}): Promise<ResearchResult> {
  const normalized = query.trim(); if (!normalized) throw new Error("search query is required"); if (normalized.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");
  const key = cacheKey(normalized, options); const cached = getCached(key); if (cached) return cached;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), getTimeoutMs());
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(normalized)}`;
      const response = await fetch(url, { headers: { accept: "text/html", "user-agent": "BobAI/1.0 local-research" }, signal: controller.signal, redirect: "error" });
      const contentLength = Number(response.headers.get("content-length")); if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      const text = await response.text(); if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      if (!response.ok) { if (attempt < MAX_RETRIES && (response.status === 408 || response.status === 429 || response.status >= 500)) { await sleep(250 * 2 ** attempt); continue; } throw new Error(`web search returned ${response.status}`); }
      const result = { query: normalized, sources: parseDuckDuckGo(text, normalized) }; putCached(key, result); return result;
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(250 * 2 ** attempt);
    } finally { clearTimeout(timer); }
  }
  throw new Error("web search unavailable");
}
