import path from "node:path";
import { nativeMedia } from "./nativeMedia.js";

const PIPER_MODEL = process.env.BOBAI_PIPER_MODEL_PATH || "";
const PIPER_EN_MODEL = process.env.BOBAI_PIPER_EN_MODEL_PATH || PIPER_MODEL;
const PIPER_TE_MODEL = process.env.BOBAI_PIPER_TE_MODEL_PATH || PIPER_MODEL;
const PIPER_CONFIG = process.env.BOBAI_PIPER_CONFIG_PATH || "";
const PIPER_EN_CONFIG = process.env.BOBAI_PIPER_EN_CONFIG_PATH || PIPER_CONFIG;
const PIPER_TE_CONFIG = process.env.BOBAI_PIPER_TE_CONFIG_PATH || PIPER_CONFIG;
const ESPEAK_DATA = process.env.BOBAI_ESPEAK_DATA_PATH || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildPiperArgs(modelPath: string, outputPath: string, lengthScale?: number): string[] { return [modelPath, outputPath, ...(lengthScale === undefined ? [] : [String(lengthScale)])]; }
function containsTelugu(text: string) { return /[\u0C00-\u0C7F]/.test(text); }

export async function synthesizeLocal(text: string, options?: Record<string, unknown> | null) {
  if (!ESPEAK_DATA) throw new Error("BobVoice requires BOBAI_ESPEAK_DATA_PATH");
  if (!text.trim() || text.length > 20_000) throw new Error("text exceeds 20,000 character limit");
  const telugu = containsTelugu(text);
  const model = telugu ? PIPER_TE_MODEL : PIPER_EN_MODEL;
  const config = telugu ? PIPER_TE_CONFIG : PIPER_EN_CONFIG;
  if (!model) throw new Error(`BobVoice requires ${telugu ? "BOBAI_PIPER_TE_MODEL_PATH" : "BOBAI_PIPER_EN_MODEL_PATH"}`);
  const safeOptions = asOptions(options);
  const rawScale = typeof safeOptions.lengthScale === "number" ? safeOptions.lengthScale : 0.88;
  const lengthScale = Math.min(Math.max(rawScale, 0.5), 2);
  const audio = nativeMedia.require().synthesize(path.resolve(model), config ? path.resolve(config) : "", path.resolve(ESPEAK_DATA), text.trim(), lengthScale);
  if (!audio.length || audio.length > 64 * 1024 * 1024) throw new Error("BobVoice output is invalid or too large");
  return { audio: audio.toString("base64"), mimeType: "audio/wav", engine: "BobVoice/Piper", model: path.basename(model), language: telugu ? "Telugu" : "English", offline: true, voiceProfile: "Ai-Glasses Jarvis offline profile" };
}
export async function piperStatus() {
  return {
    ...nativeMedia.status(),
    modelConfigured: Boolean(PIPER_EN_MODEL || PIPER_TE_MODEL),
    englishVoiceConfigured: Boolean(PIPER_EN_MODEL),
    teluguVoiceConfigured: Boolean(PIPER_TE_MODEL),
    englishModel: PIPER_EN_MODEL ? path.basename(PIPER_EN_MODEL) : null,
    teluguModel: PIPER_TE_MODEL ? path.basename(PIPER_TE_MODEL) : null,
    espeakDataConfigured: Boolean(ESPEAK_DATA),
  };
}
