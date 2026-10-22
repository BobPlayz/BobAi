import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unloadOllamaModelsIfMemoryLow } from "./ollamaProvider.js";
import { withLocalModelLock } from "./localModelLock.js";
import { nativeMedia } from "./nativeMedia.js";
import { validatePcm16Wav } from "./wavSafety.js";
import { repoFile } from "./repoPaths.js";

const WHISPER_MODEL = process.env.BOBAI_WHISPER_MODEL_PATH || "";
const PYTHON = process.env.BOBAI_VOICE_PYTHON || "";
const PYTHON_MODEL = process.env.BOBAI_WHISPER_PYTHON_MODEL_PATH || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export function buildWhisperArgs(modelPath: string, inputPath: string, outputBase: string): string[] { return [modelPath, inputPath, outputBase]; }
function existsFile(value: string) { try { return Boolean(value && statSync(path.resolve(value)).isFile()); } catch { return false; } }
function existsDirectory(value: string) { try { return Boolean(value && statSync(path.resolve(value)).isDirectory()); } catch { return false; } }

async function transcribeWithPython(input: Buffer, threads: number) {
  if (!PYTHON || !existsFile(PYTHON)) throw new Error("Local speech recognition is not configured. Run npm run setup:local-media.");
  if (!PYTHON_MODEL || !existsDirectory(PYTHON_MODEL)) throw new Error("The local faster-whisper model is missing. Run npm run setup:local-media.");
  const directory = await mkdtemp(path.join(tmpdir(), "jarvis-whisper-"));
  const audioPath = path.join(directory, "input.wav");
  const workerPath = repoFile("scripts/local_whisper_transcribe.py");
  try {
    await writeFile(audioPath, input);
    const result = await new Promise<{ text?: string; language?: string; error?: string }>((resolve, reject) => {
      const child = spawn(PYTHON, [workerPath, path.resolve(PYTHON_MODEL), audioPath, String(threads)], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("local speech recognition timed out")); }, 180_000);
      child.stdout.on("data", (chunk: Buffer) => { stdout = (stdout + chunk.toString("utf8")).slice(-200_000); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4000); });
      child.once("error", (error) => { clearTimeout(timer); reject(new Error("could not start local speech recognition: " + error.message)); });
      child.once("close", (code) => {
        clearTimeout(timer);
        let parsed: { text?: string; language?: string; error?: string } | undefined;
        try { parsed = JSON.parse(stdout); } catch {}
        if (code !== 0 || !parsed || typeof parsed.text !== "string") {
          reject(new Error(parsed?.error || stderr.trim() || "local speech recognition failed"));
          return;
        }
        resolve(parsed);
      });
    });
    return { text: result.text!.trim(), engine: "BobWhisper/faster-whisper CPU", model: path.basename(PYTHON_MODEL), language: result.language };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function transcribeLocal(input: Buffer, options?: Record<string, unknown> | null) {
  return withLocalModelLock(async () => {
    if (input.length > 25 * 1024 * 1024) throw new Error("audio exceeds 25 MB limit");
    validatePcm16Wav(input, 25 * 1024 * 1024);
    const safeOptions = asOptions(options);
    const threads = typeof safeOptions.threads === "number" && Number.isFinite(safeOptions.threads) ? Math.min(Math.max(Math.trunc(safeOptions.threads), 1), 8) : 4;
    // Piper and Whisper are small; evicting the ~2-3 GB chat model here forced a full reload on every voice turn.
    await unloadOllamaModelsIfMemoryLow();
    if (nativeMedia.status().ready && existsFile(WHISPER_MODEL)) {
      const result = nativeMedia.require().transcribe(path.resolve(WHISPER_MODEL), input, threads);
      return { text: result.trim(), engine: "BobWhisper/native-whisper.cpp", model: path.basename(WHISPER_MODEL) };
    }
    return transcribeWithPython(input, threads);
  });
}

export async function whisperStatus() {
  const native = nativeMedia.status();
  const modelExists = existsFile(WHISPER_MODEL);
  const pythonModelExists = existsDirectory(PYTHON_MODEL);
  const pythonConfigured = Boolean(PYTHON && existsFile(PYTHON));
  const nativeReady = native.ready && modelExists;
  const pythonReady = pythonConfigured && pythonModelExists;
  return {
    ...native,
    ready: nativeReady || pythonReady,
    engine: pythonReady && !nativeReady ? "faster-whisper CPU (local)" : native.engine,
    modelConfigured: Boolean(WHISPER_MODEL || PYTHON_MODEL),
    modelExists: modelExists || pythonModelExists,
    pythonConfigured,
    pythonModelExists,
    model: PYTHON_MODEL && pythonModelExists ? path.basename(PYTHON_MODEL) : WHISPER_MODEL ? path.basename(WHISPER_MODEL) : null,
  };
}
