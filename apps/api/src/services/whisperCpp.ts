import path from "node:path";
import { nativeMedia } from "./nativeMedia.js";
const WHISPER_MODEL = process.env.BOBAI_WHISPER_MODEL_PATH || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildWhisperArgs(modelPath: string, inputPath: string, outputBase: string): string[] { return [modelPath, inputPath, outputBase]; }
export async function transcribeLocal(input: Buffer, options?: Record<string, unknown> | null) { if (!WHISPER_MODEL) throw new Error("BobWhisper requires BOBAI_WHISPER_MODEL_PATH"); if (input.length > 25 * 1024 * 1024) throw new Error("audio exceeds 25 MB limit"); const safeOptions = asOptions(options); const threads = typeof safeOptions.threads === "number" ? Math.min(Math.max(Math.trunc(safeOptions.threads), 1), 16) : 4; const result = nativeMedia.require().transcribe(path.resolve(WHISPER_MODEL), input, threads); return { text: result.trim(), engine: "BobWhisper/native-whisper.cpp", model: path.basename(WHISPER_MODEL) }; }
export async function whisperStatus() { return { ...nativeMedia.status(), modelConfigured: Boolean(WHISPER_MODEL) }; }
