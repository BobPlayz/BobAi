import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandAvailable, runCommand } from "./localCommand.js";

const PIPER_COMMAND = process.env.BOBAI_PIPER_COMMAND || "piper";
const PIPER_MODEL = process.env.BOBAI_PIPER_MODEL_PATH || "";
const asOptions = (value: Record<string, unknown> | undefined | null) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function buildPiperArgs(modelPath: string, outputPath: string, lengthScale?: number): string[] {
  const args = ["--model", modelPath, "--output_file", outputPath];
  if (lengthScale !== undefined) args.push("--length_scale", String(lengthScale));
  return args;
}

export async function synthesizeLocal(text: string, options?: Record<string, unknown> | null) {
  if (!PIPER_MODEL) throw new Error("BOBAI_PIPER_MODEL_PATH is not configured");
  if (!text.trim() || text.length > 20_000) throw new Error("text exceeds 20,000 character limit");
  const safeOptions = asOptions(options);
  const dir = await mkdtemp(join(tmpdir(), "bobai-piper-"));
  const output = join(dir, "speech.wav");
  try {
    const rawScale = typeof safeOptions.lengthScale === "number" ? safeOptions.lengthScale : undefined;
    const lengthScale = rawScale === undefined ? undefined : Math.min(Math.max(rawScale, 0.5), 2);
    const result = await runCommand(PIPER_COMMAND, buildPiperArgs(PIPER_MODEL, output, lengthScale), { input: text.trim(), timeoutMs: 180_000 });
    if (result.code !== 0) throw new Error(result.stderr.toString("utf8").slice(-2_000) || "local TTS failed");
    const audio = await readFile(output);
    if (!audio.length || audio.length > 64 * 1024 * 1024) throw new Error("TTS output is invalid or too large");
    return { audio: audio.toString("base64"), mimeType: "audio/wav", engine: "BobVoice/Piper", model: PIPER_MODEL.split(/[\\/]/).pop() || "local" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function piperStatus() {
  return { command: PIPER_COMMAND, modelConfigured: Boolean(PIPER_MODEL), executableAvailable: await commandAvailable(PIPER_COMMAND) };
}
