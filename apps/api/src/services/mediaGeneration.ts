type GeneratedImage = { url: string; prompt: string; index: number };
type LocalMediaProvider = { baseUrl: string; imagePath: string; videoPath: string };

const DEFAULT_IMAGE_PROVIDER = "https://image.pollinations.ai/prompt";

function provider(): LocalMediaProvider | null {
  const baseUrl = process.env.BOBAI_LOCAL_MEDIA_URL?.trim();
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  if (!isLoopback(url.hostname)) throw new Error("BOBAI_LOCAL_MEDIA_URL must point to localhost or a loopback address");
  return {
    baseUrl: url.origin,
    imagePath: process.env.BOBAI_LOCAL_IMAGE_PATH?.trim() || "/generate/image",
    videoPath: process.env.BOBAI_LOCAL_VIDEO_PATH?.trim() || "/generate/video",
  };
}

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

async function localGenerate(path: string, prompt: string, index: number) {
  const config = provider();
  if (!config) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(new URL(path, config.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, index }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`local media provider returned ${response.status}`);
    const body = await response.json() as { url?: unknown; data?: Array<{ url?: unknown }> };
    const url = typeof body.url === "string" ? body.url : typeof body.data?.[0]?.url === "string" ? body.data[0].url : null;
    if (!url) throw new Error("local media provider returned no media URL");
    return url;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImages(prompt: string, count = 4): Promise<GeneratedImage[]> {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("image prompt is required");
  const requested = Math.max(1, Math.min(4, Math.floor(count)));
  const local = provider();

  const images = await Promise.all(Array.from({ length: requested }, async (_, index) => {
    const url = local
      ? await localGenerate(local.imagePath, normalized, index)
      : `${DEFAULT_IMAGE_PROVIDER}/${encodeURIComponent(normalized)}?model=flux&width=1024&height=1024&seed=${Date.now() + index * 9999}&nologo=true`;
    return { url: url!, prompt: normalized, index };
  }));

  return images;
}

export async function generateVideo(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("video prompt is required");
  const config = provider();
  if (!config) throw new Error("local video generation is not configured; set BOBAI_LOCAL_MEDIA_URL");
  const url = await localGenerate(config.videoPath, normalized, 0);
  return { url, prompt: normalized };
}
