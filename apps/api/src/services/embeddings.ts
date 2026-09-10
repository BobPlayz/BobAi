const MAX_INPUT = 8_000;
const DIMENSIONS = 1_536;

export function embeddingsConfigured() {
  return Boolean(process.env.BOBAI_EMBEDDING_PROVIDER_URL?.trim());
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const url = process.env.BOBAI_EMBEDDING_PROVIDER_URL?.trim();
  if (!url) return null;
  const input = text.trim().slice(0, MAX_INPUT);
  if (!input) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = process.env.BOBAI_EMBEDDING_PROVIDER_TOKEN?.trim();
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: process.env.BOBAI_EMBEDDING_MODEL?.trim(), input }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json() as { data?: Array<{ embedding?: unknown }> };
    const vector = body.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== DIMENSIONS || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
    return vector as number[];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
