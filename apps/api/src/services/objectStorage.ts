import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAX_OBJECT_BYTES = 10 * 1024 * 1024;
// Vercel functions have a read-only deployment directory; only the temp dir is writable (and not persistent).
// Extracted text and chunks live in Postgres, so document understanding survives; raw bytes may not.
const DEFAULT_ROOT = process.env.VERCEL === "1" ? path.join(tmpdir(), "jarvis-objects") : path.join(process.cwd(), "storage", "objects");
// On Vercel a storage folder copied from .env.example (like "storage/objects") points into the read-only deployment,
// which made every upload fail with "failed to process file"; only folders inside the temp dir are writable there.
function storageRoot() {
  const configured = process.env.BOBAI_FILE_STORAGE_DIR?.trim();
  if (!configured) return DEFAULT_ROOT;
  const resolved = path.resolve(configured);
  if (process.env.VERCEL === "1" && resolved !== tmpdir() && !resolved.startsWith(`${tmpdir()}${path.sep}`)) return DEFAULT_ROOT;
  return resolved;
}
const ROOT = storageRoot();

function safeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(normalized)) throw new Error("invalid storage key");
  return normalized;
}
function objectPath(key: string) {
  const safe = safeKey(key);
  const resolved = path.resolve(ROOT, safe);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error("storage path escapes root");
  return resolved;
}

export async function putObject(key: string, data: Buffer) {
  if (data.length > MAX_OBJECT_BYTES) throw new Error("object exceeds the 10 MB limit");
  const target = objectPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, data, { flag: "wx" });
  await fs.rename(temporary, target);
  return { provider: "local-fs", key: safeKey(key), size: data.length };
}

export async function getObject(key: string) { return fs.readFile(objectPath(key)); }
export async function deleteObject(key: string) { await fs.unlink(objectPath(key)).catch((error: unknown) => { if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error; }); }
