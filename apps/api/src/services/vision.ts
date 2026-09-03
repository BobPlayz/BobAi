const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 8_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function getConfig() {
  const model = process.env.BOBAI_VISION_MODEL?.trim();
  if (!model) throw new Error("vision model is not configured; set BOBAI_VISION_MODEL");
  const parsed = new URL((process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Ollama URL must use HTTP or HTTPS");
  if (!isLoopback(parsed.hostname) && process.env.NODE_ENV === "production") throw new Error("production vision provider must use a loopback Ollama endpoint");
  return { baseUrl: parsed.toString().replace(/\/$/, ""), model };
}

function getTimeoutMs() {
  const configured = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), 300_000) : DEFAULT_TIMEOUT_MS;
}

export async function analyzeImage(imageBase64: string, prompt = "describe this image in useful detail") {
  const normalizedImage = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!normalizedImage) throw new Error("image data is required");
  if (normalizedImage.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)) throw new Error("image exceeds the 12 MB limit");
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH) throw new Error("vision prompt is too long");

  const { baseUrl, model } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: prompt.trim() || "describe this image in useful detail", images: [normalizedImage] }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`vision provider returned ${response.status}`);
    const data = await response.json() as { message?: { content?: unknown } };
    const content = data.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("vision provider returned no response");
    return { model, response: content.trim() };
  } finally {
    clearTimeout(timer);
  }
}
