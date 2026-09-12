import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandAvailable, runCommand } from "./localCommand.js";

const FFMPEG_COMMAND = process.env.BOBAI_FFMPEG_COMMAND || "ffmpeg";
const FFPROBE_COMMAND = process.env.BOBAI_FFPROBE_COMMAND || "ffprobe";
const FORMAT_RE = /^[a-z0-9]{1,12}$/;
const ALLOWED_FORMATS = new Set(["wav", "mp3", "ogg", "opus", "m4a", "mp4", "webm", "gif", "png", "jpg", "jpeg"]);

export function buildFfmpegArgs(inputPath: string, outputPath: string, format: string): string[] {
  return ["-hide_banner", "-loglevel", "error", "-i", inputPath, "-map_metadata", "-1", "-y", "-f", format, outputPath];
}

export async function convertMedia(input: Buffer, format: string, options: Record<string, unknown> = {}) {
  if (input.length > 32 * 1024 * 1024) throw new Error("media exceeds 32 MB limit");
  const normalized = format.toLowerCase();
  if (!FORMAT_RE.test(normalized) || !ALLOWED_FORMATS.has(normalized)) throw new Error("unsupported output format");
  const dir = await mkdtemp(join(tmpdir(), "bobai-ffmpeg-"));
  const source = join(dir, "input.bin");
  const output = join(dir, `output.${normalized}`);
  try {
    await writeFile(source, input, { mode: 0o600 });
    const args = buildFfmpegArgs(source, output, normalized);
    if (options.audioOnly === true) args.splice(7, 0, "-vn");
    if (typeof options.width === "number" && typeof options.height === "number" && Number.isInteger(options.width) && Number.isInteger(options.height) && options.width > 0 && options.height > 0 && options.width <= 4096 && options.height <= 4096) args.splice(7, 0, "-vf", `scale=${options.width}:${options.height}`);
    const result = await runCommand(FFMPEG_COMMAND, args, { timeoutMs: 180_000 });
    if (result.code !== 0) throw new Error(result.stderr.toString("utf8").slice(-2_000) || "ffmpeg conversion failed");
    const media = await readFile(output);
    if (!media.length || media.length > 64 * 1024 * 1024) throw new Error("FFmpeg output is invalid or too large");
    return { media: media.toString("base64"), format: normalized, mimeType: mimeFor(normalized), engine: "FFmpeg" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function mediaStatus() {
  return { ffmpeg: { command: FFMPEG_COMMAND, available: await commandAvailable(FFMPEG_COMMAND) }, ffprobe: { command: FFPROBE_COMMAND, available: await commandAvailable(FFPROBE_COMMAND) } };
}

export async function probeMedia(input: Buffer) {
  if (input.length > 32 * 1024 * 1024) throw new Error("media exceeds 32 MB limit");
  const dir = await mkdtemp(join(tmpdir(), "bobai-ffprobe-"));
  const source = join(dir, "input.bin");
  try {
    await writeFile(source, input, { mode: 0o600 });
    const result = await runCommand(FFPROBE_COMMAND, ["-v", "error", "-show_entries", "format=format_name,duration,size:stream=index,codec_type,codec_name,width,height,sample_rate,channels", "-of", "json", source], { timeoutMs: 30_000 });
    if (result.code !== 0) throw new Error(result.stderr.toString("utf8").slice(-2_000) || "ffprobe failed");
    return JSON.parse(result.stdout.toString("utf8")) as unknown;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function mimeFor(format: string) {
  const values: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/opus", m4a: "audio/mp4", mp4: "video/mp4", webm: "video/webm", gif: "image/gif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  return values[format] || "application/octet-stream";
}
