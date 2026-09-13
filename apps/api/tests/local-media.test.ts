import test from "node:test";
import assert from "node:assert/strict";
import { buildPiperArgs } from "../src/services/bobVoice.js";
import { buildWhisperArgs } from "../src/services/whisperCpp.js";
import { buildFfmpegArgs, convertMedia } from "../src/services/ffmpeg.js";

test("local media builders pass structured native arguments without shell syntax", () => {
  assert.deepEqual(buildPiperArgs("C:\\models\\voice.onnx", "C:\\tmp\\speech.wav", 1), ["C:\\models\\voice.onnx", "C:\\tmp\\speech.wav", "1"]);
  assert.deepEqual(buildWhisperArgs("C:\\models\\ggml-base.bin", "C:\\tmp\\audio.wav", "C:\\tmp\\transcript"), ["C:\\models\\ggml-base.bin", "C:\\tmp\\audio.wav", "C:\\tmp\\transcript"]);
  assert.deepEqual(buildFfmpegArgs("C:\\tmp\\input.bin", "C:\\tmp\\output.wav", "wav"), ["C:\\tmp\\input.bin", "C:\\tmp\\output.wav", "wav"]);
  assert.equal([buildPiperArgs("model", "output", 1), buildWhisperArgs("model", "input", "transcript"), buildFfmpegArgs("input", "output", "wav")].flat().some((value) => value.includes(";")), false);
});

test("native media conversion rejects formats outside its explicit service boundary", async () => {
  await assert.rejects(() => convertMedia(Buffer.alloc(0), "mp4"), /PCM16 WAV only/);
  assert.deepEqual(buildFfmpegArgs("input", "output.wav", "wav"), ["input", "output.wav", "wav"]);
});
