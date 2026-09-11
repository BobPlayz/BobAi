import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type SandboxPolicy = { timeoutMs: number; memoryMb: number; cpuCount: number; maxOutputBytes: number; allowNetwork: boolean };
export type SandboxResult = { exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean };
const DEFAULT_POLICY: SandboxPolicy = { timeoutMs: 120_000, memoryMb: 1024, cpuCount: 1, maxOutputBytes: 512_000, allowNetwork: false };
const MAX_POLICY: SandboxPolicy = { timeoutMs: 15 * 60_000, memoryMb: 4096, cpuCount: 4, maxOutputBytes: 2 * 1024 * 1024, allowNetwork: false };
export function normalizeSandboxPolicy(input?: Partial<SandboxPolicy>): SandboxPolicy { return { timeoutMs: Math.min(Math.max(Math.floor(input?.timeoutMs ?? DEFAULT_POLICY.timeoutMs), 1000), MAX_POLICY.timeoutMs), memoryMb: Math.min(Math.max(Math.floor(input?.memoryMb ?? DEFAULT_POLICY.memoryMb), 128), MAX_POLICY.memoryMb), cpuCount: Math.min(Math.max(Math.floor(input?.cpuCount ?? DEFAULT_POLICY.cpuCount), 1), MAX_POLICY.cpuCount), maxOutputBytes: Math.min(Math.max(Math.floor(input?.maxOutputBytes ?? DEFAULT_POLICY.maxOutputBytes), 4096), MAX_POLICY.maxOutputBytes), allowNetwork: false }; }
function dockerAvailable() { return process.env.BOBAI_SANDBOX_RUNTIME === "docker"; }
export async function runSandbox(command: string, args: string[], files: Record<string, string> = {}, requested?: Partial<SandboxPolicy>): Promise<SandboxResult> {
  if (!dockerAvailable()) throw new Error("isolated sandbox runtime is not configured");
  if (!/^[A-Za-z0-9._/+@:-]{1,200}$/.test(command) || args.length > 100 || args.some((arg) => typeof arg !== "string" || arg.length > 2000)) throw new Error("invalid sandbox command");
  const limits = normalizeSandboxPolicy(requested); const workspace = await mkdtemp(path.join(tmpdir(), "bobai-sandbox-"));
  try { for (const [name, content] of Object.entries(files).slice(0, 100)) { if (!/^[A-Za-z0-9._/-]{1,240}$/.test(name) || name.includes("..")) throw new Error("invalid sandbox file path"); if (content.length > 512_000) throw new Error("sandbox file is too large"); const target = path.resolve(workspace, name); if (!target.startsWith(`${workspace}${path.sep}`)) throw new Error("sandbox file escapes workspace"); await writeFile(target, content, "utf8"); }
    const dockerArgs = ["run", "--rm", "--init", "--network=none", "--read-only", "--pids-limit=128", `--memory=${limits.memoryMb}m`, `--cpus=${limits.cpuCount}`, "--cap-drop=ALL", "--security-opt=no-new-privileges", "--user=65532:65532", "--tmpfs=/tmp:rw,noexec,nosuid,size=128m", "--mount", `type=bind,src=${workspace},dst=/workspace,rw`, "-w", "/workspace", "node:22-alpine", command, ...args];
    return await new Promise((resolve, reject) => { const child = spawn("docker", dockerArgs, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); let stdout = "", stderr = "", total = 0, timedOut = false; const append = (target: "stdout" | "stderr", chunk: Buffer) => { if (total >= limits.maxOutputBytes) return; const remaining = limits.maxOutputBytes - total; const text = chunk.subarray(0, remaining).toString("utf8"); total += Buffer.byteLength(text); if (target === "stdout") stdout += text; else stderr += text; }; child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk)); child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk)); const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, limits.timeoutMs); child.once("error", (error) => { clearTimeout(timer); reject(error); }); child.once("close", (exitCode, signal) => { clearTimeout(timer); resolve({ exitCode, signal, stdout, stderr, timedOut }); }); });
  } finally { await rm(workspace, { recursive: true, force: true }); }
}
