import { inflateSync } from "node:zlib";
import { analyzeImage } from "./vision.js";

const MAX_IMAGES = 3;
const MAX_IMAGE_BASE64 = 2_000_000;
const MAX_PROMPT = 6_000;
const MAX_PIXELS = 4_000_000;

type Rgb = { r: number; g: number; b: number };
export type VioletImageReport = {
  index: number;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  dominantColors?: Array<{ hex: string; pixels: number }>;
  pixelAnalysis?: "exact-png" | "vision-model-only";
};

function parseImage(value: string) {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("Violet accepts only PNG, JPEG, or WebP data URLs");
  const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  if (!base64 || base64.length > MAX_IMAGE_BASE64) throw new Error("visual input exceeds the 2 MB agent limit");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > Math.floor(MAX_IMAGE_BASE64 * 0.75)) throw new Error("invalid visual input");
  return { mimeType, base64, buffer };
}

function hex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function readPng(buffer: Buffer): VioletImageReport | null {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) return null;
    if (type === "IHDR" && length === 13) {
      width = buffer.readUInt32BE(start);
      height = buffer.readUInt32BE(start + 4);
      bitDepth = buffer[start + 8];
      colorType = buffer[start + 9];
      interlace = buffer[start + 12];
    } else if (type === "IDAT") {
      idat.push(buffer.subarray(start, end));
    } else if (type === "IEND") break;
    offset = end + 4;
  }
  if (!width || !height || width * height > MAX_PIXELS || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0 || !idat.length) return null;
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const expected = height * (rowBytes + 1);
  if (!Number.isSafeInteger(expected) || expected > MAX_PIXELS * 4 + MAX_PIXELS) return null;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    return null;
  }
  if (inflated.length < expected) return null;

  const previous = Buffer.alloc(rowBytes);
  const colors = new Map<string, number>();
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1);
    const filter = inflated[rowStart];
    const row = Buffer.alloc(rowBytes);
    const source = inflated.subarray(rowStart + 1, rowStart + 1 + rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= channels ? previous[x - channels] || 0 : 0;
      const value = source[x];
      if (filter === 0) row[x] = value;
      else if (filter === 1) row[x] = (value + left) & 255;
      else if (filter === 2) row[x] = (value + up) & 255;
      else if (filter === 3) row[x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        row[x] = (value + predictor) & 255;
      } else return null;
    }
    for (let x = 0; x < width; x += 1) {
      const i = x * channels;
      const alpha = channels === 4 ? row[i + 3] : 255;
      if (alpha < 32) continue;
      const rgb: Rgb = { r: row[i], g: row[i + 1], b: row[i + 2] };
      const key = hex(rgb);
      colors.set(key, (colors.get(key) || 0) + 1);
    }
    row.copy(previous);
  }

  const dominantColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color, pixels]) => ({ hex: color, pixels }));
  return { index: 0, mimeType: "image/png", bytes: buffer.length, width, height, dominantColors, pixelAnalysis: "exact-png" };
}

export async function analyzeWithViolet(images: string[], prompt = "Analyze these visual inputs for a coding task. Identify layout, components, spacing, typography, colors, states, visual defects, and implementation-relevant details. Do not invent details that are not visible.") {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) throw new Error(`Violet accepts 1-${MAX_IMAGES} images`);
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT) throw new Error("Violet prompt is too long");

  const parsed = images.map(parseImage);
  const reports = parsed.map((image, index) => {
    const report = image.mimeType === "image/png" ? readPng(image.buffer) : null;
    return report ? { ...report, index } : { index, mimeType: image.mimeType, bytes: image.buffer.length, pixelAnalysis: "vision-model-only" as const };
  });

  const modelReports: string[] = [];
  for (const image of parsed) {
    const result = await analyzeImage(image.base64, prompt.trim() || "Analyze this image for a coding task in useful detail.");
    modelReports.push(result.response);
  }

  return { specialist: "violet", reports, model: modelReports.length ? process.env.BOBAI_VISION_MODEL : undefined, analysis: modelReports };
}
