import { ollamaVision } from "./ollamaProvider.js";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 8_000;

function normalizeImage(image: string) {
  const value = image.trim();
  const dataUrl = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  const encoded = dataUrl ? dataUrl[2] : value;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("image must be valid PNG, JPEG, or WebP base64 data");
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) throw new Error("image exceeds the 12 MB limit");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) throw new Error("image must be valid PNG, JPEG, or WebP base64 data");
  const mime = dataUrl?.[1].toLowerCase();
  const actual = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
    : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "jpeg"
    : bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "webp" : "";
  if (!actual) throw new Error("image format is unsupported or does not match its content");
  if (mime && (mime === "jpg" ? "jpeg" : mime) !== actual) throw new Error("image MIME does not match its content");
  return encoded;
}

export async function analyzeImage(imageBase64: string, prompt = "analyze this image", signal?: AbortSignal) {
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) throw new Error("image data is required");
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH) throw new Error("vision prompt is too long");
  const normalized = normalizeImage(imageBase64);
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("vision analysis cancelled");
  const result = await ollamaVision(normalized, prompt.trim() || "Describe the image and relevant details.", signal);
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("vision analysis cancelled");
  return { model: result.model, response: result.content.slice(0, 8_000), provider: "local-ollama" as const };
}
