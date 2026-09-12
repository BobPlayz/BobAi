import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandAvailable, runCommand } from "./localCommand.js";

const WHISPER_COMMAND = process.env.BOBAI_WHISPER_COMMAND || "whisper-cli";
const WHISPER_MODEL = process.env.BOBAI_WHISPER_MODEL_PATH || "";
const FFMPEG_COMMAND = process.env.BOBAI_FFMPEG_COMMAND || "ffmpeg";

export function buildWhisperArgs(modelPath: string, inputPath: string, outputBase: string): string[] {
  return ["-m", modelPath, "-f", inputPath, "-otxt", "-of", outputBase, "-nt", "-np"];
}

export async function transcribeLocal(input: Buffer, options: Record<string, unknown> = {}) {
  if (!WHISPER_MODEL) throw new Error("BOBAI_WHISPER_MODEL_PATH is not configured");
  if (input.length > 25 * 1024 * 1024) throw new Error("audio exceeds 25 MB limit");
  const dir = await mkdtemp(join(tmpdir(), "bobai-whisper-"));
  const source = join(dir, "source.bin");
  const wav = join(dir, "audio.wav");
  const outputBase = join(dir, "transcript");
  try {
    await writeFile(source, input, { mode: 0o600 });
    const convert = await runCommand(FFMPEG_COMMAND, ["-hide_banner", "-loglevel", "error", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", wav, "-y"], { timeoutMs: 120_000 });
    if (convert.code !== 0) throw new Error(convert.stderr.toString("utf8").slice(-2_000) || "ffmpeg conversion failed");
    const language = typeof options.language === "string" && /^[A-Za-z-]{2,12}$/.test(options.language) ? options.language : "";
    const args = buildWhisperArgs(WHISPER_MODEL, wav, outputBase);
    if (language) args.push("-l", language);
    const result = await runCommand(WHISPER_COMMAND, args, { timeoutMs: 180_000 });
    if (result.code !== 0) throw new Error(result.stderr.toString("utf8").slice(-2_000) || "whisper transcription failed");
    const text = (await readFile(`${outputBase}.txt`, "utf8")).trim();
    return { text, engine: "whisper.cpp", model: WHISPER_MODEL.split(/[\\/]/).pop() || "local", language: language || undefined };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function whisperStatus() {
  return { command: WHISPER_COMMAND, modelConfigured: Boolean(WHISPER_MODEL), executableAvailable: await commandAvailable(WHISPER_COMMAND), ffmpegAvailable: await commandAvailable(FFMPEG_COMMAND) };
}
