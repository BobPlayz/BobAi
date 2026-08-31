const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 2_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_RETRIES = 2;

function getProvider() {
  const configured = process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim();
  if (!configured) throw new Error("web search provider is not configured");
  const url = new URL(configured);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback)) throw new Error("web search provider must use HTTPS outside local development");
  return url.toString().replace(/\/$/, "");
}

function getTimeoutMs() {
  const configured = Number(process.env.BOBAI_RESEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), 120_000) : DEFAULT_TIMEOUT_MS;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ResearchSource = { title: string; url: string; snippet?: string; publishedAt?: string };
export type ResearchResult = { query: string; sources: ResearchSource[]; providerData?: unknown };

function normalizeSources(body: unknown): ResearchSource[] {
  const candidate = body && typeof body === "object" ? (body as Record<string, unknown>).results ?? (body as Record<string, unknown>).sources : undefined;
  if (!Array.isArray(candidate)) return [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const item of candidate) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const url = typeof value.url === "string" ? value.url.trim() : typeof value.link === "string" ? value.link.trim() : "";
    if (!url) continue;
    try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) continue; const canonical = parsed.toString(); if (seen.has(canonical)) continue; seen.add(canonical); sources.push({ title: typeof value.title === "string" ? value.title.slice(0, 500) : canonical, url: canonical, snippet: typeof value.snippet === "string" ? value.snippet.slice(0, 3000) : typeof value.description === "string" ? value.description.slice(0, 3000) : undefined, publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : undefined }); } catch { /* ignore malformed provider URLs */ }
  }
  return sources.slice(0, 50);
}

export async function webSearch(query: string, options: Record<string, unknown> = {}): Promise<ResearchResult> {
  const normalized = query.trim();
  if (!normalized) throw new Error("search query is required");
  if (normalized.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");

  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = process.env.BOBAI_RESEARCH_PROVIDER_KEY?.trim();
  if (key) headers.authorization = `Bearer ${key}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), getTimeoutMs());
    try {
      const response = await fetch(getProvider(), { method: "POST", headers, body: JSON.stringify({ query: normalized, ...options }), signal: controller.signal });
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
      if (!response.ok) { if (attempt < MAX_RETRIES && (response.status === 408 || response.status === 429 || response.status >= 500)) { await sleep(250 * 2 ** attempt); continue; } throw new Error(`web search provider returned ${response.status}`); }
      let body: unknown = {};
      if (text.trim()) { try { body = JSON.parse(text); } catch { body = { data: text }; } }
      return { query: normalized, sources: normalizeSources(body), providerData: body };
    } finally { clearTimeout(timer); }
  }
  throw new Error("web search provider unavailable");
}
