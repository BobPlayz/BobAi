export function validatePcm16Wav(input: Buffer, maxBytes: number) {
  if (input.length < 44 || input.length > maxBytes) throw new Error("audio is not a valid PCM16 WAV payload");
  if (input.subarray(0, 4).toString("ascii") !== "RIFF" || input.subarray(8, 12).toString("ascii") !== "WAVE") throw new Error("audio must be a PCM16 WAV file");
  const riffEnd = input.readUInt32LE(4) + 8;
  if (riffEnd < 12 || riffEnd > input.length) throw new Error("audio WAV RIFF size is invalid or truncated");
  let pos = 12; let format = 0; let channels = 0; let sampleRate = 0; let byteRate = 0; let blockAlign = 0; let bitsPerSample = 0; let dataBytes = 0;
  while (pos + 8 <= riffEnd) {
    const size = input.readUInt32LE(pos + 4); const end = pos + 8 + size;
    if (end > riffEnd) throw new Error("audio WAV chunk is truncated");
    const id = input.subarray(pos, pos + 4).toString("ascii");
    if (id === "fmt ") {
      if (size < 16) throw new Error("audio WAV format chunk is truncated");
      format = input.readUInt16LE(pos + 8); channels = input.readUInt16LE(pos + 10); sampleRate = input.readUInt32LE(pos + 12);
      byteRate = input.readUInt32LE(pos + 16); blockAlign = input.readUInt16LE(pos + 20); bitsPerSample = input.readUInt16LE(pos + 22);
    }
    if (id === "data") dataBytes = size;
    pos = end + (size & 1);
  }
  if (pos !== riffEnd) throw new Error("audio WAV contains a malformed chunk boundary");
  if (format !== 1 || bitsPerSample !== 16 || channels < 1 || channels > 2 || sampleRate < 8_000 || sampleRate > 192_000 || blockAlign !== channels * 2 || byteRate !== sampleRate * blockAlign || dataBytes === 0 || dataBytes % blockAlign !== 0) throw new Error("audio must be PCM16 WAV with a supported sample rate and channel count");
  const frames = dataBytes / (2 * channels); const durationSeconds = frames / sampleRate;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 15 * 60) throw new Error("audio duration exceeds the 15 minute limit");
  return { sampleRate, channels, frames, durationSeconds };
}
