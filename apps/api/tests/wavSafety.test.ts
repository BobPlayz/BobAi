import test from "node:test";
import assert from "node:assert/strict";
import { validatePcm16Wav } from "../src/services/wavSafety.js";

function wav(sampleRate: number, frames: number, channels = 1) { const dataBytes = frames * channels * 2; const buffer = Buffer.alloc(44 + dataBytes); buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVEfmt ", 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * channels * 2, 28); buffer.writeUInt16LE(channels * 2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40); return buffer; }

test("PCM16 WAV validation rejects pathological sample rates and duration", () => {
  assert.equal(validatePcm16Wav(wav(16_000, 16_000), 25 * 1024 * 1024).sampleRate, 16_000);
  assert.throws(() => validatePcm16Wav(wav(1, 1), 25 * 1024 * 1024), /supported sample rate/);
  assert.throws(() => validatePcm16Wav(wav(48_000, 48_000 * 16 * 60), 25 * 1024 * 1024), /15 minute/);
});

test("PCM16 WAV validation rejects malformed chunks and channel counts", () => {
  const broken = wav(16_000, 100); broken.writeUInt32LE(10_000, 40); assert.throws(() => validatePcm16Wav(broken, 25 * 1024 * 1024), /truncated/);
  assert.throws(() => validatePcm16Wav(wav(16_000, 100, 3), 25 * 1024 * 1024), /channel count/);
});
