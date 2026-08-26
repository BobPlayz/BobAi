type GeneratedImage = { url: string; prompt: string; index: number };
type LocalMediaProvider = { baseUrl: string; imagePath: string; videoPath: string };

type MediaOptions = {
  prompt: string;
  count?: number;
  inputImages?: string[];
  width?: number;
  height?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  seed?: number;
};

const DEFAULT_IMAGE_PROVIDER = "https://image.pollinations.ai/prompt";
const MAX_INPUT_IMAGES = 4;
const MAX_PROMPT_LENGTH = 8000;

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function provider(): LocalMediaProvider | null {
  const baseUrl = process.env.BOBAI_LOCAL_MEDIA_URL?.trim();
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("BOBAI_LOCAL_MEDIA_URL must use HTTP or HTTPS");
  if (!isLoopback(url.hostname)) throw new Error("BOBAI_LOCAL_MEDIA_URL must point to localhost or a loopback address");
  return {
    baseUrl: url.origin,
    imagePath: process.env.BOBAI_LOCAL_IMAGE_PATH?.trim() || "/generate/image",
    videoPath: process.env.BOBAI_LOCAL_VIDEO_PATH?.trim() || "/generate/video",
  };
}

function normalizeImages(inputImages: string[] | undefined) {
  if (!inputImages) return [];
  if (!Array.isArray(inputImages) || inputImages.length > MAX_INPUT_IMAGES) throw new Error("up to 4 input images are supported");
  return inputImages.filter((image) => typeof image === "string" && image.trim()).slice(0, MAX_INPUT_IMAGES);
}

async function localGenerate(path: string, options: MediaOptions) {
  const config = provider();
  if (!config) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(new URL(path, config.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: options.prompt,
        count: options.count ?? 1,
        inputImages: normalizeImages(options.inputImages),
        width: options.width,
        height: options.height,
        durationSeconds: options.durationSeconds,
        aspectRatio: options.aspectRatio,
        seed: options.seed,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`local media provider returned ${response.status}`);
    const body = await response.json() as { url?: unknown; urls?: unknown; data?: Array<{ url?: unknown }> };
    const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string") : [];
    const dataUrls = Array.isArray(body.data) ? body.data.map((item) => item?.url).filter((url): url is string => typeof url === "string") : [];
    const all = typeof body.url === "string" ? [body.url] : [...urls, ...dataUrls];
    if (!all.length) throw new Error("local media provider returned no media URL");
    return all;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImages(prompt: string, count = 4, inputImages?: string[]): Promise<GeneratedImage[]> {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("image prompt is required");
  if (normalized.length > MAX_PROMPT_LENGTH) throw new Error("image prompt is too long");
  const requested = Math.max(1, Math.min(4, Math.floor(count)));
  const inputs = normalizeImages(inputImages);
  const local = provider();

  if (local) {
    const urls = await localGenerate(local.imagePath, { prompt: normalized, count: requested, inputImages: inputs });
    if (urls.length < requested) throw new Error(`local image provider returned ${urls.length} of ${requested} requested images`);
    return urls.slice(0, requested).map((url, index) => ({ url, prompt: normalized, index }));
  }

  return Promise.all(Array.from({ length: requested }, async (_, index) => ({
    url: `${DEFAULT_IMAGE_PROVIDER}/${encodeURIComponent(normalized)}?model=flux&width=1024&height=1024&seed=${Date.now() + index * 9999}&nologo=true`,
    prompt: normalized,
    index,
  })));
}

export async function generateVideo(prompt: string, inputImages?: string[]) {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("video prompt is required");
  if (normalized.length > MAX_PROMPT_LENGTH) throw new Error("video prompt is too long");
  const config = provider();
  if (!config) throw new Error("local video generation is not configured; set BOBAI_LOCAL_MEDIA_URL");
  const urls = await localGenerate(config.videoPath, { prompt: normalized, inputImages: normalizeImages(inputImages) });
  const url = urls[0];
  if (!url) throw new Error("local video provider returned no media URL");
  return { url, prompt: normalized };
}
