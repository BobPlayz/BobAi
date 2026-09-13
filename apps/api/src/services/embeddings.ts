import { createHash } from "node:crypto";
import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";

const MAX_INPUT = 8_000;
const DIMENSIONS = 1_536;
const SPECIALIST_DIMENSIONS = 128;

function expandSpecialist(vector: number[]) {
  const out = new Float64Array(DIMENSIONS);
  for (let i = 0; i < DIMENSIONS; i++) out[i] = vector[i % SPECIALIST_DIMENSIONS] * (1 + ((i / SPECIALIST_DIMENSIONS) | 0) * 0.0001);
  let norm = 0; for (const value of out) norm += value * value; norm = Math.sqrt(norm) || 1; return Array.from(out, (value) => value / norm);
}

function localEmbedding(text: string): number[] {
  const vector = new Float64Array(DIMENSIONS); const normalized = text.normalize("NFKC").toLowerCase(); const terms = normalized.split(/\s+/).filter(Boolean);
  for (const term of terms) { const digest = createHash("sha256").update(term).digest(); for (let i = 0; i < 8; i++) vector[digest.readUInt16BE(i * 2) % DIMENSIONS] += digest[i] / 255 - 0.5; }
  if (!terms.length) return Array.from(vector); let norm = 0; for (const value of vector) norm += value * value; norm = Math.sqrt(norm) || 1; return Array.from(vector, (value) => value / norm);
}

export function embeddingsConfigured() { return true; }
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const input = text.trim().slice(0, MAX_INPUT); if (!input) return null;
  if (specialistConfigured("embedding")) { try { const result = await specialistInfer("embedding", { text: input }); if (Array.isArray(result.vector) && result.vector.length === SPECIALIST_DIMENSIONS && result.vector.every((x) => typeof x === "number")) return expandSpecialist(result.vector as number[]); } catch { /* fallback until a trained artifact exists */ } }
  return localEmbedding(input);
}

export async function rerank(query: number[], document: number[]) {
  if (query.length !== SPECIALIST_DIMENSIONS || document.length !== SPECIALIST_DIMENSIONS || !specialistConfigured("reranking")) return null;
  try { const result = await specialistInfer("reranking", { query, document }); return typeof result.score === "number" ? Math.max(0, Math.min(1, result.score)) : null; } catch { return null; }
}
