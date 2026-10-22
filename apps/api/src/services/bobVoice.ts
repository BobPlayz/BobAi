import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unloadOllamaModelsIfMemoryLow } from "./ollamaProvider.js";
import { withLocalModelLock } from "./localModelLock.js";
import { nativeMedia } from "./nativeMedia.js";
import { validatePcm16Wav } from "./wavSafety.js";

const PIPER_MODEL = process.env.BOBAI_PIPER_MODEL_PATH || "";
const PIPER_EN_MODEL = process.env.BOBAI_PIPER_EN_MODEL_PATH || PIPER_MODEL;
const PIPER_TE_MODEL = process.env.BOBAI_PIPER_TE_MODEL_PATH || PIPER_MODEL;
const PIPER_CONFIG = process.env.BOBAI_PIPER_CONFIG_PATH || "";
const PIPER_EN_CONFIG = process.env.BOBAI_PIPER_EN_CONFIG_PATH || PIPER_CONFIG;
const PIPER_TE_CONFIG = process.env.BOBAI_PIPER_TE_CONFIG_PATH || PIPER_CONFIG;
const ESPEAK_DATA = process.env.BOBAI_ESPEAK_DATA_PATH || "";
const PIPER_COMMAND = process.env.BOBAI_PIPER_COMMAND || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildPiperArgs(modelPath: string, outputPath: string, lengthScale?: number): string[] { return [modelPath, outputPath, ...(lengthScale === undefined ? [] : [String(lengthScale)])]; }
function containsTelugu(text: string) { return /[\u0C00-\u0C7F]/.test(text); }
function existsFile(value: string) { try { return Boolean(value && statSync(path.resolve(value)).isFile()); } catch { return false; } }
function existsDirectory(value: string) { try { return Boolean(value && statSync(path.resolve(value)).isDirectory()); } catch { return false; } }

async function synthesizeWithPiperCli(model: string, config: string, text: string, lengthScale: number) {
  if (!PIPER_COMMAND || !existsFile(PIPER_COMMAND)) throw new Error("Piper CLI is unavailable. Run npm run setup:local-media.");
  const directory = await mkdtemp(path.join(tmpdir(), "jarvis-piper-"));
  const output = path.join(directory, "speech.wav");
  try {
    await new Promise<void>((resolve, reject) => {
      const args = ["--model", path.resolve(model), "--output_file", output, "--length_scale", String(lengthScale)];
      if (config) args.push("--config", path.resolve(config));
      // Piper (both the legacy C++ CLI and the piper-tts package) reads phoneme data from ESPEAK_DATA_PATH.
      const child = spawn(PIPER_COMMAND, args, { windowsHide: true, stdio: ["pipe", "ignore", "pipe"], env: ESPEAK_DATA ? { ...process.env, ESPEAK_DATA_PATH: path.resolve(ESPEAK_DATA) } : process.env });
      let stderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Piper speech synthesis timed out")); }, 120_000);
      child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4000); });
      child.once("error", (error) => { clearTimeout(timer); reject(new Error("could not start local Piper: " + error.message)); });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || "local Piper failed to synthesize speech"));
      });
      child.stdin.end(text);
    });
    return await readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function synthesizeLocal(text: string, options?: Record<string, unknown> | null) {
  return withLocalModelLock(async () => {
    if (!text.trim() || text.length > 20_000) throw new Error("text exceeds 20,000 character limit");
    const telugu = containsTelugu(text);
    const model = telugu ? PIPER_TE_MODEL : PIPER_EN_MODEL;
    const config = telugu ? PIPER_TE_CONFIG : PIPER_EN_CONFIG;
    if (!model || !existsFile(model)) throw new Error(`BobVoice requires a valid ${telugu ? "BOBAI_PIPER_TE_MODEL_PATH" : "BOBAI_PIPER_EN_MODEL_PATH"}`);
    const safeOptions = asOptions(options);
    const rawScale = typeof safeOptions.lengthScale === "number" && Number.isFinite(safeOptions.lengthScale) ? safeOptions.lengthScale : 0.88;
    const lengthScale = Math.min(Math.max(rawScale, 0.5), 2);
    // Piper and Whisper are small; evicting the ~2-3 GB chat model here forced a full reload on every voice turn.
    await unloadOllamaModelsIfMemoryLow();
    let audio: Buffer;
    if (nativeMedia.status().ready && ESPEAK_DATA && existsDirectory(ESPEAK_DATA)) {
      audio = nativeMedia.require().synthesize(path.resolve(model), config ? path.resolve(config) : "", path.resolve(ESPEAK_DATA), text.trim(), lengthScale);
    } else {
      audio = await synthesizeWithPiperCli(model, config, text.trim(), lengthScale);
    }
    if (!audio.length || audio.length > 64 * 1024 * 1024) throw new Error("BobVoice output is invalid or too large");
    validatePcm16Wav(audio, 64 * 1024 * 1024);
    return { audio: audio.toString("base64"), mimeType: "audio/wav", engine: nativeMedia.status().ready ? "BobVoice/Piper native" : "BobVoice/Piper CLI", model: path.basename(model), language: telugu ? "Telugu" : "English", offline: true, voiceProfile: "Ai-Glasses Jarvis offline profile" };
  });
}

export async function piperStatus() {
  const native = nativeMedia.status();
  const cliReady = Boolean(PIPER_COMMAND && existsFile(PIPER_COMMAND));
  const englishModelExists = existsFile(PIPER_EN_MODEL);
  const teluguModelExists = existsFile(PIPER_TE_MODEL);
  const englishConfigExists = !PIPER_EN_CONFIG || existsFile(PIPER_EN_CONFIG);
  const teluguConfigExists = !PIPER_TE_CONFIG || existsFile(PIPER_TE_CONFIG);
  const espeakDataExists = existsDirectory(ESPEAK_DATA);
  const englishReady = englishModelExists && englishConfigExists && (cliReady || (espeakDataExists && native.ready));
  const teluguReady = teluguModelExists && teluguConfigExists && (cliReady || (espeakDataExists && native.ready));
  return {
    ...native,
    ready: englishReady || teluguReady,
    engine: cliReady ? "Piper CLI (local)" : native.engine,
    modelConfigured: Boolean(PIPER_EN_MODEL || PIPER_TE_MODEL),
    englishVoiceConfigured: Boolean(PIPER_EN_MODEL),
    teluguVoiceConfigured: Boolean(PIPER_TE_MODEL),
    englishModel: PIPER_EN_MODEL ? path.basename(PIPER_EN_MODEL) : null,
    teluguModel: PIPER_TE_MODEL ? path.basename(PIPER_TE_MODEL) : null,
    englishModelExists,
    teluguModelExists,
    englishConfigExists,
    teluguConfigExists,
    piperCommandConfigured: Boolean(PIPER_COMMAND),
    piperCommandExists: cliReady,
    espeakDataConfigured: Boolean(ESPEAK_DATA),
    espeakDataExists,
    englishReady,
    teluguReady,
  };
}
