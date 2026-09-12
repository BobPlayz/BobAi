import test from "node:test";
import assert from "node:assert/strict";
import { buildPiperArgs } from "../src/services/bobVoice.js";
import { buildWhisperArgs } from "../src/services/whisperCpp.js";
import { buildFfmpegArgs } from "../src/services/ffmpeg.js";

test("local media command builders never use a shell", () => {
  assert.deepEqual(buildPiperArgs("C:\\models\\voice.onnx", "C:\\tmp\\speech.wav", 1), ["--model", "C:\\models\\voice.onnx", "--output_file", "C:\\tmp\\speech.wav", "--length_scale", "1"]);
  assert.deepEqual(buildWhisperArgs("C:\\models\\ggml-base.bin", "C:\\tmp\\audio.wav", "C:\\tmp\\transcript"), ["-m", "C:\\models\\ggml-base.bin", "-f", "C:\\tmp\\audio.wav", "-otxt", "-of", "C:\\tmp\\transcript", "-nt", "-np"]);
  assert.deepEqual(buildFfmpegArgs("C:\\tmp\\input.bin", "C:\\tmp\\output.wav", "wav"), ["-hide_banner", "-loglevel", "error", "-i", "C:\\tmp\\input.bin", "-map_metadata", "-1", "-y", "-f", "wav", "C:\\tmp\\output.wav"]);
});

test("local media output formats are explicit and bounded by the service", () => {
  const args = buildFfmpegArgs("input", "output.mp4", "mp4");
  assert.equal(args.includes("-f"), true);
  assert.equal(args[args.indexOf("-f") + 1], "mp4");
  assert.equal(args.some((value) => value.includes(";")), false);
});
