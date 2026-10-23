import type { GeneratedImage } from "./mediaGeneration.js";

/**
 * Image generation through Pollinations (https://pollinations.ai): free, no account or key. Used on the hosted site,
 * where the local Diffusers generator cannot run. Requests are private (kept out of Pollinations' public feed) and
 * use its safe-content filter on top of Jarvis's own prompt screening. Prompts are sent to Pollinations.
 * Without a key the free tier allows about one picture every 45 seconds per server IP, so keyless requests make one
 * picture and wait (up to 50 seconds) when rate limited. POLLINATIONS_API_KEY (a free "pollen" key from enter.pollinations.ai)
 * lifts that limit.
 */
const BASE = "https://image.pollinations.ai/prompt/";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 90_000;
const MAX_WAIT_SECONDS = 50;

function apiKey() {
  return process.env.POLLINATIONS_API_KEY?.trim() || "";
}

/** Seconds Pollinations asks us to wait ("Retry after 3s"), or null when it is not a rate limit. */
export function pollinationsRetryAfter(status: number, body: string, header: string | null) {
  if (status !== 402 && status !== 429) return null;
  // The free-limit 402 comes either as JSON naming FREE_LIMIT or as a placeholder image with a Retry-After header.
  if (status === 402 && !header && !/FREE_LIMIT|free limit/i.test(body)) return null;
  const seconds = Number(header) || Number(/retry after (\d+)\s*s/i.exec(body)?.[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 45;
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

export function pollinationsUrl(prompt: string, options: { width: number; height: number; seed: number }) {
  const url = new URL(BASE + encodeURIComponent(prompt));
  url.searchParams.set("width", String(options.width));
  url.searchParams.set("height", String(options.height));
  url.searchParams.set("seed", String(options.seed));
  url.searchParams.set("model", process.env.BOBAI_POLLINATIONS_MODEL?.trim() || "flux");
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  url.searchParams.set("safe", "true");
  return url;
}

export async function pollinationsGenerate(prompt: string, count: number, signal: AbortSignal | undefined, options: { width: number; height: number; seed?: number }): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];
  const key = apiKey();
  // Keyless: one picture per request, since the free tier allows one every 45 seconds.
  const total = key ? count : 1;
  for (let index = 0; index < total; index += 1) {
    const seed = options.seed !== undefined ? options.seed + index : Math.floor(Math.random() * 2_147_483_647);
    let response: Response;
    for (let attempt = 0; ; attempt += 1) {
      response = await fetch(pollinationsUrl(prompt, { width: options.width, height: options.height, seed }), {
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "image/*", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      });
      if (response.ok) break;
      const isJson = /json|text/i.test(response.headers.get("content-type") || "");
      const body = isJson ? await response.text().catch(() => "") : (await response.body?.cancel().catch(() => undefined), "");
      const wait = pollinationsRetryAfter(response.status, body, response.headers.get("retry-after"));
      if (wait === null) throw new Error(`the image service returned HTTP ${response.status}; try again in a moment`);
      if (attempt > 0 || wait > MAX_WAIT_SECONDS) throw new Error(`the image service is busy (the free plan makes about one picture every 45 seconds). try again in ${Math.min(Math.ceil(wait), 60)} seconds.`);
      await sleep(wait * 1000, signal);
    }
    const type = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("the image service returned something that is not an image; try again in a moment");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("the image service returned an image that is empty or too large");
    images.push({ url: `data:${type};base64,${bytes.toString("base64")}`, prompt, index, seed, width: options.width, height: options.height });
  }
  return images;
}
