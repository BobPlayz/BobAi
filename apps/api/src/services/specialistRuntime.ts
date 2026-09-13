import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";

const HOST = "127.0.0.1";
const BASE_PORT = Math.min(65500, Math.max(1024, Number(process.env.BOBAI_SPECIALIST_BASE_PORT || 39700)));
const PYTHON = process.env.BOBAI_PYTHON || "python";
const ROOT = process.env.BOBAI_SPECIALIST_ROOT || "model-training/output";
const TIMEOUT_MS = Math.min(120_000, Math.max(5_000, Number(process.env.BOBAI_SPECIALIST_TIMEOUT_MS || 30_000)));
const paths: Record<string, string | undefined> = {
  embedding: process.env.BOBAI_VECTOR_MODEL_PATH || `${ROOT}/bob-embed-0.1.pt`,
  reranking: process.env.BOBAI_VANTA_RERANKER_MODEL_PATH || `${ROOT}/bob-reranker-0.1.pt`,
  vision: process.env.BOBAI_VANTA_MODEL_PATH || `${ROOT}/bob-vision-0.1.pt`,
  asr: process.env.BOBAI_ECHO_ASR_MODEL_PATH || `${ROOT}/bob-asr-0.1.pt`,
  tts: process.env.BOBAI_ECHO_TTS_MODEL_PATH || `${ROOT}/bob-tts-0.1.pt`,
  image: process.env.BOBAI_FLUX_MODEL_PATH || `${ROOT}/bob-image-0.1.pt`,
};
const kinds = ["embedding", "reranking", "vision", "asr", "tts", "image"] as const;
type Kind = typeof kinds[number];
type Child = { process: ChildProcessWithoutNullStreams; port: number; token: string; ready: Promise<void> };

const children = new Map<Kind, Child>();
const ports = new Map<Kind, number>();

function kindArg(kind: Kind) { return kind === "embedding" ? "embed" : kind === "reranking" ? "reranker" : kind; }
function portFor(kind: Kind) { if (!ports.has(kind)) ports.set(kind, BASE_PORT + kinds.indexOf(kind)); return ports.get(kind)!; }

async function waitForReady(port: number, token: string, child: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("specialist worker exited during startup");
    try { const response = await fetch(`http://${HOST}:${port}/health`, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  child.kill(); throw new Error("specialist worker startup timed out");
}

export async function ensureSpecialist(kind: Kind) {
  const existing = children.get(kind); if (existing) { await existing.ready; return existing; }
  const model = paths[kind]; if (!model) throw new Error(`no ${kind} model path configured`);
  const token = randomBytes(32).toString("base64url"); const port = portFor(kind);
  const child = spawn(PYTHON, ["model-training/specialist_server.py", kindArg(kind), "--model", model, "--host", HOST, "--port", String(port), "--token", token], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stderr.on("data", (chunk) => { if (process.env.NODE_ENV !== "production") process.stderr.write(`[${kind}] ${chunk}`); });
  const ready = waitForReady(port, token, child).catch((error) => { children.delete(kind); throw error; });
  const entry = { process: child, port, token, ready }; children.set(kind, entry); await ready; return entry;
}

export async function specialistInfer(kind: Kind, payload: Record<string, unknown>) {
  const worker = await ensureSpecialist(kind);
  const response = await fetch(`http://${HOST}:${worker.port}/infer`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${worker.token}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`specialist ${kind} returned ${response.status}`);
  const data = await response.json() as Record<string, unknown>; if (typeof data.error === "string") throw new Error(data.error); return data;
}

export function specialistConfigured(kind: Kind) { return Boolean(paths[kind]); }
export async function stopSpecialist(kind: Kind) { const child = children.get(kind); if (!child) return; child.process.kill(); children.delete(kind); }
export async function stopAllSpecialists() { await Promise.all(kinds.map(stopSpecialist)); }
process.once("SIGTERM", () => { void stopAllSpecialists(); }); process.once("SIGINT", () => { void stopAllSpecialists(); });
