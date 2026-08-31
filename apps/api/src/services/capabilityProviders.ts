import { providerAvailable, recordProviderFailure, recordProviderSuccess } from "./providerHealth.js";

export type ProviderCapability =
  | "image_upscale" | "background_removal" | "object_removal" | "image_editing"
  | "video_generation" | "image_to_video" | "talking_image" | "talking_avatar"
  | "face_swap" | "short_clip_finder" | "voice_synthesis" | "speech_to_text"
  | "meeting_transcription" | "music_generation" | "music_discovery" | "diagram_generation" | "sketch_to_ui";

type ProviderConfig = { capability: ProviderCapability; env: string; keyEnv?: string; description: string };
const PROVIDERS: ProviderConfig[] = [
  { capability: "image_upscale", env: "BOBAI_IMAGE_UPSCALE_PROVIDER_URL", keyEnv: "BOBAI_IMAGE_UPSCALE_PROVIDER_KEY", description: "Upscale and enhance images." },
  { capability: "background_removal", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", keyEnv: "BOBAI_IMAGE_EDIT_PROVIDER_KEY", description: "Remove image backgrounds." },
  { capability: "object_removal", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", keyEnv: "BOBAI_IMAGE_EDIT_PROVIDER_KEY", description: "Remove unwanted image objects." },
  { capability: "image_editing", env: "BOBAI_IMAGE_EDIT_PROVIDER_URL", keyEnv: "BOBAI_IMAGE_EDIT_PROVIDER_KEY", description: "Prompt-driven image editing." },
  { capability: "video_generation", env: "BOBAI_VIDEO_PROVIDER_URL", keyEnv: "BOBAI_VIDEO_PROVIDER_KEY", description: "Generate video from text or media." },
  { capability: "image_to_video", env: "BOBAI_VIDEO_PROVIDER_URL", keyEnv: "BOBAI_VIDEO_PROVIDER_KEY", description: "Animate a still image into video." },
  { capability: "talking_image", env: "BOBAI_TALKING_AVATAR_PROVIDER_URL", keyEnv: "BOBAI_TALKING_AVATAR_PROVIDER_KEY", description: "Turn a still image into a talking video." },
  { capability: "talking_avatar", env: "BOBAI_TALKING_AVATAR_PROVIDER_URL", keyEnv: "BOBAI_TALKING_AVATAR_PROVIDER_KEY", description: "Create a talking avatar from a photo." },
  { capability: "face_swap", env: "BOBAI_FACE_SWAP_PROVIDER_URL", keyEnv: "BOBAI_FACE_SWAP_PROVIDER_KEY", description: "Consent-based face replacement in supported media." },
  { capability: "short_clip_finder", env: "BOBAI_VIDEO_EDIT_PROVIDER_URL", keyEnv: "BOBAI_VIDEO_EDIT_PROVIDER_KEY", description: "Find candidate clips from long-form video." },
  { capability: "voice_synthesis", env: "BOBAI_VOICE_PROVIDER_URL", keyEnv: "BOBAI_VOICE_PROVIDER_KEY", description: "Generate speech from text." },
  { capability: "speech_to_text", env: "BOBAI_VOICE_PROVIDER_URL", keyEnv: "BOBAI_VOICE_PROVIDER_KEY", description: "Transcribe audio to text." },
  { capability: "meeting_transcription", env: "BOBAI_VOICE_PROVIDER_URL", keyEnv: "BOBAI_VOICE_PROVIDER_KEY", description: "Transcribe meetings with timestamps when supported." },
  { capability: "music_generation", env: "BOBAI_MUSIC_PROVIDER_URL", keyEnv: "BOBAI_MUSIC_PROVIDER_KEY", description: "Generate or edit music." },
  { capability: "music_discovery", env: "BOBAI_MUSIC_PROVIDER_URL", keyEnv: "BOBAI_MUSIC_PROVIDER_KEY", description: "Discover and organize music." },
  { capability: "diagram_generation", env: "BOBAI_DESIGN_PROVIDER_URL", keyEnv: "BOBAI_DESIGN_PROVIDER_KEY", description: "Turn structured ideas into diagrams and visual specifications." },
  { capability: "sketch_to_ui", env: "BOBAI_DESIGN_PROVIDER_URL", keyEnv: "BOBAI_DESIGN_PROVIDER_KEY", description: "Turn sketches or screenshots into UI specifications." },
];
const PROVIDER_ID = "capability-provider";
const isLoopback = (hostname: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
function getProviderConfig(capability: ProviderCapability) {
  const config = PROVIDERS.find((item) => item.capability === capability);
  if (!config) throw new Error(`unsupported provider capability: ${capability}`);
  const raw = process.env[config.env]?.trim();
  if (!raw) throw new Error(`${capability} provider is not configured`);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${capability} provider URL is invalid`); }
  const developmentLoopback = process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLoopback(url.hostname);
  if (url.protocol !== "https:" && !developmentLoopback) throw new Error(`${capability} provider must use HTTPS outside local development`);
  return { ...config, url, key: config.keyEnv ? process.env[config.keyEnv]?.trim() : undefined };
}
export function listProviderCapabilities() { return PROVIDERS.map(({ capability, description, env, keyEnv }) => ({ capability, description, configured: Boolean(process.env[env]?.trim()), authenticated: Boolean(keyEnv && process.env[keyEnv]?.trim()) })); }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function executeProviderCapability(capability: ProviderCapability, input: Record<string, unknown>) {
  const config = getProviderConfig(capability);
  if (!providerAvailable(PROVIDER_ID)) throw new Error("capability provider is temporarily unavailable");
  const configuredTimeout = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 5_000), 300_000) : 120_000;
  const maxRetries = Math.min(Math.max(Number(process.env.BOBAI_PROVIDER_RETRIES || 2), 0), 3);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.key) headers.authorization = `Bearer ${config.key}`;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(config.url, { method: "POST", headers, body: JSON.stringify({ capability, ...input }), signal: controller.signal });
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) throw new Error("provider response exceeds the 10 MB limit");
      const text = await response.text();
      if (text.length > 10 * 1024 * 1024) throw new Error("provider response exceeds the 10 MB limit");
      if (!response.ok) {
        if (attempt < maxRetries && (response.status === 408 || response.status === 429 || response.status >= 500)) { recordProviderFailure(PROVIDER_ID); await sleep(250 * 2 ** attempt); continue; }
        recordProviderFailure(PROVIDER_ID);
        throw new Error(`provider returned ${response.status}`);
      }
      recordProviderSuccess(PROVIDER_ID);
      if (!text.trim()) return {};
      try { return JSON.parse(text) as unknown; } catch { return { data: text }; }
    } catch (error) {
      if (attempt >= maxRetries) recordProviderFailure(PROVIDER_ID);
      throw error;
    } finally { clearTimeout(timer); }
  }
  throw new Error("provider unavailable");
}
