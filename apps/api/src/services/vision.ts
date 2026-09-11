const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 8_000;
const MAX_RESPONSE_CHARS = 200_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function getConfig() {
  const baseUrl = process.env.BOBAI_VISION_PROVIDER_URL?.trim().replace(/\/$/, "");
  const model = process.env.BOBAI_VISION_MODEL?.trim();
  if (!baseUrl || !model) throw new Error("vision provider is not configured");
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("vision provider URL is invalid"); }
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && loopback)) throw new Error("vision provider must use HTTPS outside local development");
  return { baseUrl, model, key: process.env.BOBAI_VISION_PROVIDER_TOKEN?.trim() || "" };
}

function timeoutMs() {
  const value = Number(process.env.BOBAI_VISION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) ? Math.min(Math.max(value, 5_000), 300_000) : DEFAULT_TIMEOUT_MS;
}

export async function analyzeImage(imageBase64: string, prompt = "describe this image in useful detail") {
  const normalizedImage = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!normalizedImage) throw new Error("image data is required");
  if (normalizedImage.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)) throw new Error("image exceeds the 12 MB limit");
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH) throw new Error("vision prompt is too long");
  const { baseUrl, model, key } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: [
        { type: "text", text: prompt.trim() || "describe this image in useful detail" },
        { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${normalizedImage}` } },
      ] }] }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`vision provider returned ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) throw new Error("vision provider returned an invalid response");
    return { model: typeof data.model === "string" ? data.model : model, response: content.trim() };
  } finally { clearTimeout(timer); }
}
