import { nativeMedia } from "./nativeMedia.js";
const ALLOWED_NATIVE_FORMATS = new Set(["wav"]);
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildFfmpegArgs(inputPath: string, outputPath: string, format: string): string[] { return [inputPath, outputPath, format]; }
export async function convertMedia(input: Buffer, format: string, options?: Record<string, unknown> | null) { if (input.length > 32 * 1024 * 1024) throw new Error("media exceeds 32 MB limit"); const normalized = format.toLowerCase(); if (!ALLOWED_NATIVE_FORMATS.has(normalized)) throw new Error("native BobMedia currently supports PCM16 WAV only; no external FFmpeg process is used"); nativeMedia.require().probeWav(input); const safeOptions = asOptions(options); if (safeOptions.audioOnly !== undefined && safeOptions.audioOnly !== true) throw new Error("invalid audioOnly option"); return { media: input.toString("base64"), format: normalized, mimeType: "audio/wav", engine: "BobMedia/native" }; }
export async function mediaStatus() { return nativeMedia.status(); }
export async function probeMedia(input: Buffer) { if (input.length > 32 * 1024 * 1024) throw new Error("media exceeds 32 MB limit"); return nativeMedia.require().probeWav(input); }
