import test from "node:test";
import assert from "node:assert/strict";
import { validatePcm16Wav } from "../src/services/wavSafety.js";

function wav(sampleRate: number, frames: number, channels = 1) { const dataBytes = frames * channels * 2; const buffer = Buffer.alloc(44 + dataBytes); buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVEfmt ", 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * channels * 2, 28); buffer.writeUInt16LE(channels * 2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40); return buffer; }

test("PCM16 WAV validation rejects pathological sample rates and duration", () => {
  assert.equal(validatePcm16Wav(wav(16_000, 16_000), 25 * 1024 * 1024).sampleRate, 16_000);
  assert.throws(() => validatePcm16Wav(wav(1, 1), 25 * 1024 * 1024), /supported sample rate/);
  assert.throws(() => validatePcm16Wav(wav(8_000, 8_000 * 15 * 60 + 1), 25 * 1024 * 1024), /15 minute/);
});

test("PCM16 WAV validation rejects malformed chunks and channel counts", () => {
  const broken = wav(16_000, 100); broken.writeUInt32LE(10_000, 40); assert.throws(() => validatePcm16Wav(broken, 25 * 1024 * 1024), /truncated/);
  assert.throws(() => validatePcm16Wav(wav(16_000, 100, 3), 25 * 1024 * 1024), /channel count/);
});

test("PCM16 WAV validation rejects non-16-bit data and inconsistent format metadata", () => {
  const nonPcm16 = wav(16_000, 100);
  nonPcm16.writeUInt16LE(24, 34);
  assert.throws(() => validatePcm16Wav(nonPcm16, 25 * 1024 * 1024), /PCM16 WAV/);

  const wrongByteRate = wav(16_000, 100);
  wrongByteRate.writeUInt32LE(1, 28);
  assert.throws(() => validatePcm16Wav(wrongByteRate, 25 * 1024 * 1024), /PCM16 WAV/);

  const wrongRiffLength = wav(16_000, 100);
  wrongRiffLength.writeUInt32LE(20, 4);
  assert.throws(() => validatePcm16Wav(wrongRiffLength, 25 * 1024 * 1024), /truncated|chunk boundary/);
});
