export type ProviderCapability =
  | "image_upscale"
  | "background_removal"
  | "object_removal"
  | "image_editing"
  | "video_generation"
  | "image_to_video"
  | "talking_image"
  | "talking_avatar"
  | "face_swap"
  | "short_clip_finder"
  | "voice_synthesis"
  | "speech_to_text"
  | "meeting_transcription"
  | "music_generation"
  | "music_discovery"
  | "diagram_generation"
  | "sketch_to_ui";

type ProviderConfig = {
  capability: ProviderCapability;
  env: string;
  description: string;
};

const PROVIDERS: ProviderConfig[] = [
  { capability: "image_upscale", env: "BOBAI_IMAGE_UPSCALE_PROVIDER_URL", description: "Upscale and enhance images." },
  { capability: "background_removal", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", description: "Remove image backgrounds." },
  { capability: "object_removal", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", description: "Remove unwanted image objects." },
  { capability: "image_editing", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", description: "Prompt-driven image editing." },
  { capability: "video_generation", env: "BOBAI_VIDEO_PROVIDER_URL", description: "Generate video from text or media." },
  { capability: "image_to_video", env: "BOBAI_VIDEO_PROVIDER_URL", description: "Animate a still image into video." },
  { capability: "talking_image", env: "BOBAI_TALKING_AVATAR_PROVIDER_URL", description: "Turn a still image into a talking video." },
  { capability: "talking_avatar", env: "BOBAI_TALKING_AVATAR_PROVIDER_URL", description: "Create a talking avatar from a photo." },
  { capability: "face_swap", env: "BOBAI_FACE_SWAP_PROVIDER_URL", description: "Consent-based face replacement in supported media." },
  { capability: "short_clip_finder", env: "BOBAI_VIDEO_EDIT_PROVIDER_URL", description: "Find candidate clips from long-form video." },
  { capability: "voice_synthesis", env: "BOBAI_VOICE_PROVIDER_URL", description: "Generate speech from text." },
  { capability: "speech_to_text", env: "BOBAI_VOICE_PROVIDER_URL", description: "Transcribe audio to text." },
  { capability: "meeting_transcription", env: "BOBAI_VOICE_PROVIDER_URL", description: "Transcribe meetings with timestamps when supported." },
  { capability: "music_generation", env: "BOBAI_MUSIC_PROVIDER_URL", description: "Generate or edit music." },
  { capability: "music_discovery", env: "BOBAI_MUSIC_PROVIDER_URL", description: "Discover and organize music." },
  { capability: "diagram_generation", env: "BOBAI_DESIGN_PROVIDER_URL", description: "Turn ideas into diagrams and visual specifications." },
  { capability: "sketch_to_ui", env: "BOBAI_DESIGN_PROVIDER_URL", description: "Turn sketches or screenshots into UI specifications." },
];

const isLoopback = (hostname: string) =>
  ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());

function getProviderConfig(capability: ProviderCapability) {
  const config = PROVIDERS.find((item) => item.capability === capability);
  if (!config) throw new Error(`unsupported provider capability: ${capability}`);

  const raw = process.env[config.env]?.trim();
  if (!raw) throw new Error(`${capability} provider is not configured; set ${config.env}`);

  const url = new URL(raw);
  const developmentLoopback = process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback(url.hostname);
  if (url.protocol !== "https:" && !developmentLoopback) {
    throw new Error(`${config.env} must use HTTPS outside local development`);
  }

  return { ...config, url };
}

export function listProviderCapabilities() {
  return PROVIDERS.map(({ capability, env, description }) => ({
    capability,
    env,
    description,
    configured: Boolean(process.env[env]?.trim()),
  }));
}

export async function executeProviderCapability(
  capability: ProviderCapability,
  input: Record<string, unknown>,
) {
  const config = getProviderConfig(capability);
  const timeoutMs = Math.min(Math.max(Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000), 5_000), 300_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ capability, ...input }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (text.length > 10 * 1024 * 1024) throw new Error("provider response exceeds the 10 MB limit");

    let body: unknown = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { data: text };
      }
    }

    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}
