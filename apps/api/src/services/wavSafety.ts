export function validatePcm16Wav(input: Buffer, maxBytes: number) {
  if (input.length < 44 || input.length > maxBytes) throw new Error("audio is not a valid PCM16 WAV payload");
  if (input.subarray(0, 4).toString("ascii") !== "RIFF" || input.subarray(8, 12).toString("ascii") !== "WAVE") throw new Error("audio must be a PCM16 WAV file");
  let pos = 12; let format = 0; let channels = 0; let sampleRate = 0; let dataBytes = 0;
  while (pos + 8 <= input.length) {
    const size = input.readUInt32LE(pos + 4); const end = pos + 8 + size;
    if (end > input.length) throw new Error("audio WAV chunk is truncated");
    const id = input.subarray(pos, pos + 4).toString("ascii");
    if (id === "fmt " && size >= 16) { format = input.readUInt16LE(pos + 8); channels = input.readUInt16LE(pos + 10); sampleRate = input.readUInt32LE(pos + 12); }
    if (id === "data") dataBytes = size;
    pos = end + (size & 1);
  }
  if (format !== 1 || channels < 1 || channels > 2 || sampleRate < 8_000 || sampleRate > 192_000 || dataBytes === 0 || dataBytes % (2 * channels) !== 0) throw new Error("audio must be PCM16 WAV with a supported sample rate and channel count");
  const frames = dataBytes / (2 * channels); const durationSeconds = frames / sampleRate;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 15 * 60) throw new Error("audio duration exceeds the 15 minute limit");
  return { sampleRate, channels, frames, durationSeconds };
}
