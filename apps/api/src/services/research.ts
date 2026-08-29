const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 2_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function getProvider() {
  const configured = process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim();
  if (!configured) throw new Error("web search provider is not configured");
  const url = new URL(configured);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback)) {
    throw new Error("web search provider must use HTTPS outside local development");
  }
  return url.toString().replace(/\/$/, "");
}

function getTimeoutMs() {
  const configured = Number(process.env.BOBAI_RESEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), 120_000) : DEFAULT_TIMEOUT_MS;
}

export async function webSearch(query: string, options: Record<string, unknown> = {}) {
  const normalized = query.trim();
  if (!normalized) throw new Error("search query is required");
  if (normalized.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = process.env.BOBAI_RESEARCH_PROVIDER_KEY?.trim();
  if (key) headers.authorization = `Bearer ${key}`;

  try {
    const response = await fetch(getProvider(), { method: "POST", headers, body: JSON.stringify({ query: normalized, ...options }), signal: controller.signal });
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("web search response exceeds the 10 MB limit");
    let body: unknown = {};
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { body = { data: text }; }
    }
    if (!response.ok) throw new Error(`web search provider returned ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}
