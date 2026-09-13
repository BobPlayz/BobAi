import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename } from "node:path";

export interface ModelBundleManifest { format: "bobai-model-bundle-v1"; model: string; version: string; files: Array<{ path: string; bytes: number; sha256: string }>; }
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,240}$/;
const MAX_FILES = 256;
const MAX_FILE_BYTES = 20 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024 * 1024;

export async function createModelBundleManifest(model: string, version: string, files: string[]): Promise<ModelBundleManifest> {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model) || !/^[A-Za-z0-9._-]{1,80}$/.test(version)) throw new Error("invalid model bundle identity");
  if (files.length === 0 || files.length > MAX_FILES) throw new Error("model bundle must contain 1-256 files");
  const seen = new Set<string>(); let total = 0; const entries: ModelBundleManifest["files"] = [];
  for (const file of files) { const name = basename(file); if (!SAFE_PATH.test(name) || seen.has(name)) throw new Error("model bundle contains duplicate or invalid file names"); seen.add(name); const data = await readFile(file); if (data.byteLength > MAX_FILE_BYTES || total + data.byteLength > MAX_TOTAL_BYTES) throw new Error("model bundle exceeds its size limit"); total += data.byteLength; entries.push({ path: name, bytes: data.byteLength, sha256: createHash("sha256").update(data).digest("hex") }); }
  return { format: "bobai-model-bundle-v1", model, version, files: entries };
}

export function validateModelBundleManifest(manifest: unknown): asserts manifest is ModelBundleManifest {
  if (!manifest || typeof manifest !== "object") throw new Error("invalid model bundle manifest");
  const value = manifest as Record<string, unknown>;
  if (value.format !== "bobai-model-bundle-v1" || typeof value.model !== "string" || typeof value.version !== "string" || !Array.isArray(value.files) || value.files.length === 0 || value.files.length > MAX_FILES) throw new Error("invalid model bundle manifest");
  const seen = new Set<string>(); let total = 0;
  for (const file of value.files) { if (!file || typeof file !== "object") throw new Error("invalid model bundle file"); const entry = file as Record<string, unknown>; if (typeof entry.path !== "string" || !SAFE_PATH.test(entry.path) || entry.path.includes("..") || seen.has(entry.path) || typeof entry.bytes !== "number" || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > MAX_FILE_BYTES || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("invalid model bundle file metadata"); seen.add(entry.path); total += entry.bytes; if (total > MAX_TOTAL_BYTES) throw new Error("model bundle exceeds its size limit"); }
}
