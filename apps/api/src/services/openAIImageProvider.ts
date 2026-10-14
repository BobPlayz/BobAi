import type { GeneratedImage } from "./mediaGeneration.js";

const API_URL = "https://api.openai.com/v1/images/generations";
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 180_000;

export async function openAIImageGenerate(
  prompt: string,
  count: number,
  signal?: AbortSignal,
  options: { width?: number; height?: number } = {},
): Promise<GeneratedImage[]> {
  const apiKey = process.env.BOBAI_IMAGE_API_KEY?.trim();
  if (!apiKey) throw new Error("Power image mode needs BOBAI_IMAGE_API_KEY in your private .env file.");
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("image generation cancelled");

  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const size = width > height * 1.2 ? "1536x1024" : height > width * 1.2 ? "1024x1536" : "1024x1024";
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("power image provider timed out after 3 minutes")), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.BOBAI_IMAGE_API_MODEL?.trim() || "gpt-image-1",
        prompt,
        n: count,
        size,
        quality: "medium",
        output_format: "png",
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("power image provider response exceeded the 40 MB limit");
    let payload: { data?: Array<{ b64_json?: string; revised_prompt?: string }>; error?: { message?: string } };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error("power image provider returned an unreadable response");
    }
    if (!response.ok) {
      const detail = typeof payload.error?.message === "string" ? payload.error.message.slice(0, 240) : "";
      if (response.status === 401 || response.status === 403) throw new Error("power image provider rejected the API key or account permissions");
      if (response.status === 429) throw new Error("power image provider rate limit or quota reached; check your provider billing and limits");
      throw new Error(`power image provider request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    if (!Array.isArray(payload.data) || payload.data.length !== count) throw new Error("power image provider returned an unexpected number of images");
    return payload.data.map((item, index) => {
      if (typeof item.b64_json !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.b64_json)) {
        throw new Error("power image provider did not return valid base64 PNG data");
      }
      const bytes = Buffer.from(item.b64_json, "base64");
      if (!bytes.length || bytes.length > 9 * 1024 * 1024 || bytes.toString("base64").replace(/=+$/, "") !== item.b64_json.replace(/=+$/, "") ||
        !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        throw new Error("power image provider returned invalid or oversized PNG data");
      }
      return {
        url: "data:image/png;base64," + item.b64_json,
        prompt: item.revised_prompt || prompt,
        index,
        width: size === "1024x1024" ? 1024 : size === "1536x1024" ? 1536 : 1024,
        height: size === "1024x1024" ? 1024 : size === "1536x1024" ? 1024 : 1536,
      };
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
