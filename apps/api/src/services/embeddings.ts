import { createHash } from "node:crypto";

const MAX_INPUT = 8_000;
const DIMENSIONS = 1_536;

function localEmbedding(text: string): number[] {
  const vector = new Float64Array(DIMENSIONS);
  const normalized = text.normalize("NFKC").toLowerCase();
  const terms = normalized.split(/\s+/).filter(Boolean);
  for (const term of terms) {
    const digest = createHash("sha256").update(term).digest();
    for (let i = 0; i < 8; i++) {
      const index = digest.readUInt16BE(i * 2) % DIMENSIONS;
      vector[index] += digest[i] / 255 - 0.5;
    }
  }
  if (!terms.length) return Array.from(vector);
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vector, (value) => value / norm);
}

export function embeddingsConfigured() { return true; }
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const input = text.trim().slice(0, MAX_INPUT);
  return input ? localEmbedding(input) : null;
}
