import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface ModelArtifactManifest {
  name: string;
  version: string;
  sha256: string;
  bytes: number;
  format: string;
}

export async function inspectArtifact(path: string, manifest: ModelArtifactManifest) {
  const data = await readFile(path);
  const digest = createHash("sha256").update(data).digest("hex");
  return {
    ok: data.byteLength === manifest.bytes && digest === manifest.sha256.toLowerCase(),
    bytes: data.byteLength,
    sha256: digest,
    name: manifest.name,
    version: manifest.version,
    format: manifest.format,
  };
}
