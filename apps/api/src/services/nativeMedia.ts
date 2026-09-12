import { createRequire } from "node:module";
import path from "node:path";

type NativeMediaAddon = {
  status(): { native: boolean; whisperVersion: string; voiceEngine: string; mediaFormats: string };
  synthesize(modelPath: string, configPath: string, espeakDataPath: string, text: string, lengthScale?: number): Buffer;
  transcribe(modelPath: string, wav: Buffer, threads?: number): string;
  probeWav(wav: Buffer): { format: string; sampleRate: number; samples: number };
};

const require = createRequire(import.meta.url);
const candidates = [
  path.resolve(process.cwd(), "native/media/build/Release/bobai_media.node"),
  path.resolve(process.cwd(), "native/media/build/Debug/bobai_media.node"),
];
let addon: NativeMediaAddon | null = null;
let loadError = "native media addon is not built";
for (const candidate of candidates) {
  try { addon = require(candidate) as NativeMediaAddon; break; } catch (error) { loadError = error instanceof Error ? error.message : loadError; }
}

export function requireNativeMedia(): NativeMediaAddon {
  if (!addon) throw new Error(`BobAI native media runtime unavailable: ${loadError}`);
  return addon;
}
export function nativeMediaStatus() { if (!addon) return { ready: false, error: loadError, engine: "BobMedia native addon" }; return { ready: true, ...addon.status() }; }
export const nativeMedia = { require: requireNativeMedia, status: nativeMediaStatus };
