import path from "node:path";
import { nativeMedia } from "./nativeMedia.js";

const PIPER_MODEL = process.env.BOBAI_PIPER_MODEL_PATH || "";
const PIPER_CONFIG = process.env.BOBAI_PIPER_CONFIG_PATH || "";
const ESPEAK_DATA = process.env.BOBAI_ESPEAK_DATA_PATH || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildPiperArgs(modelPath: string, outputPath: string, lengthScale?: number): string[] { return [modelPath, outputPath, ...(lengthScale === undefined ? [] : [String(lengthScale)])]; }
export async function synthesizeLocal(text: string, options?: Record<string, unknown> | null) { if (!PIPER_MODEL || !ESPEAK_DATA) throw new Error("BobVoice requires BOBAI_PIPER_MODEL_PATH and BOBAI_ESPEAK_DATA_PATH"); if (!text.trim() || text.length > 20_000) throw new Error("text exceeds 20,000 character limit"); const safeOptions = asOptions(options); const rawScale = typeof safeOptions.lengthScale === "number" ? safeOptions.lengthScale : undefined; const lengthScale = rawScale === undefined ? undefined : Math.min(Math.max(rawScale, 0.5), 2); const audio = nativeMedia.require().synthesize(path.resolve(PIPER_MODEL), PIPER_CONFIG ? path.resolve(PIPER_CONFIG) : "", path.resolve(ESPEAK_DATA), text.trim(), lengthScale); if (!audio.length || audio.length > 64 * 1024 * 1024) throw new Error("BobVoice output is invalid or too large"); return { audio: audio.toString("base64"), mimeType: "audio/wav", engine: "BobVoice/native-libpiper", model: path.basename(PIPER_MODEL) }; }
export async function piperStatus() { return { ...nativeMedia.status(), modelConfigured: Boolean(PIPER_MODEL), configConfigured: Boolean(PIPER_CONFIG), espeakDataConfigured: Boolean(ESPEAK_DATA) }; }
