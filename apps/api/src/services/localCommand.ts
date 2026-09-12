import { spawn } from "node:child_process";

export type CommandResult = { code: number; stdout: Buffer; stderr: Buffer };

const MAX_STDOUT = 96 * 1024 * 1024;
const MAX_STDERR = 2 * 1024 * 1024;

export function runCommand(command: string, args: string[], options: { input?: Buffer | string; timeoutMs?: number; cwd?: string } = {}): Promise<CommandResult> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 120_000, 1_000), 600_000);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: "pipe" });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
    };
    child.on("error", (error) => finish(error));
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutSize += chunk.length;
      if (stdoutSize > MAX_STDOUT) { child.kill("SIGKILL"); finish(new Error("command stdout exceeded limit")); return; }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrSize += chunk.length;
      if (stderrSize <= MAX_STDERR) stderr.push(Buffer.from(chunk));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

export async function commandAvailable(command: string): Promise<boolean> {
  try {
    const result = await runCommand(command, ["--version"], { timeoutMs: 5_000 });
    return result.code === 0;
  } catch {
    return false;
  }
}
