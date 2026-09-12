import { createHash } from "node:crypto";
import { assertMediaPromptSafe } from "./mediaSafety.js";

type GeneratedImage = { url: string; prompt: string; index: number };
type MediaOptions = { prompt: string; count?: number; width?: number; height?: number; seed?: number };
const MAX_PROMPT_LENGTH = 8000;
const MAX_INPUT_IMAGES = 4;

function normalizeImages(inputImages: string[] | undefined) {
  if (!inputImages) return [];
  if (!Array.isArray(inputImages) || inputImages.length > MAX_INPUT_IMAGES) throw new Error("up to 4 input images are supported");
  return inputImages.filter((image) => typeof image === "string" && image.trim()).slice(0, MAX_INPUT_IMAGES);
}
function escapeXml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
function hashNumber(input: string, salt: string) { return createHash("sha256").update(`${salt}:${input}`).digest().readUInt32BE(0); }
function localSvg(prompt: string, index: number, options: MediaOptions) {
  const width = Math.max(256, Math.min(1536, Math.floor(options.width || 1024)));
  const height = Math.max(256, Math.min(1536, Math.floor(options.height || 1024)));
  const seed = options.seed ?? hashNumber(prompt, String(index));
  const hue = seed % 360;
  const hue2 = (hue + 55 + (seed % 80)) % 360;
  const x = 120 + (seed % Math.max(1, width - 240));
  const y = 120 + ((seed >>> 8) % Math.max(1, height - 240));
  const radius = 90 + ((seed >>> 16) % 220);
  const safePrompt = escapeXml(prompt.slice(0, 180));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 85% 58%)"/><stop offset="1" stop-color="hsl(${hue2} 80% 42%)"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="55"/></filter></defs><rect width="100%" height="100%" fill="#080b12"/><circle cx="${x}" cy="${y}" r="${radius * 1.7}" fill="url(#g)" opacity=".42" filter="url(#blur)"/><circle cx="${width - x / 2}" cy="${height - y / 2}" r="${radius}" fill="hsl(${hue2} 90% 70%)" opacity=".24"/><path d="M0 ${height * .72} Q ${width * .28} ${height * .52}, ${width * .52} ${height * .7} T ${width} ${height * .48}" fill="none" stroke="url(#g)" stroke-width="8" opacity=".7"/><rect x="56" y="56" width="${width - 112}" height="${height - 112}" rx="36" fill="none" stroke="white" stroke-opacity=".12"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="white" fill-opacity=".9" font-family="system-ui,sans-serif" font-size="${Math.max(22, Math.floor(width / 28))}" font-weight="600">${safePrompt}</text><text x="${width / 2}" y="${height - 92}" text-anchor="middle" fill="white" fill-opacity=".42" font-family="system-ui,sans-serif" font-size="18">BobAI local renderer · ${index + 1}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function generateImages(prompt: string, count = 4, inputImages?: string[]): Promise<GeneratedImage[]> {
  const normalized = prompt.trim(); if (!normalized) throw new Error("image prompt is required"); if (normalized.length > MAX_PROMPT_LENGTH) throw new Error("image prompt is too long");
  assertMediaPromptSafe(normalized); normalizeImages(inputImages);
  const requested = Math.max(1, Math.min(4, Math.floor(count)));
  return Array.from({ length: requested }, (_, index) => ({ url: localSvg(normalized, index, { prompt: normalized, count: requested }), prompt: normalized, index }));
}

export async function generateVideo(prompt: string, inputImages?: string[]) {
  const normalized = prompt.trim(); if (!normalized) throw new Error("video prompt is required"); if (normalized.length > MAX_PROMPT_LENGTH) throw new Error("video prompt is too long");
  assertMediaPromptSafe(normalized); normalizeImages(inputImages);
  throw new Error("local video generation requires a video model/runtime; BobAI does not fake video output");
}
