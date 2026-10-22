import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Finds a file that lives in the repository (for example scripts/local_whisper_transcribe.py) whether the API was
 * started from the repo root (`npm run ai`) or from apps/api (`npm run dev`), from src (tsx) or from dist.
 */
export function repoFile(relativePath: string): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "../.."), path.resolve(here, "../../../.."), path.resolve(here, "../../..")];
  for (const base of candidates) {
    const candidate = path.resolve(base, relativePath);
    if (existsSync(candidate)) return candidate;
  }
  return path.resolve(relativePath);
}
