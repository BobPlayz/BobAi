const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 2_000;

function getProvider() {
  const configured = process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim();
  if (!configured) throw new Error("web search provider is not configured");
  const url = new URL(configured);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback)) {
    throw new Error("web search provider must use HTTPS in production");
  }
  return url.toString().replace(/\/$/, "");
}

export async function webSearch(query: string, options: Record<string, unknown> = {}) {
  const normalized = query.trim();
  if (!normalized) throw new Error("search query is required");
  if (normalized.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.BOBAI_RESEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  try {
    const response = await fetch(getProvider(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: normalized, ...options }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`web search provider returned ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}
