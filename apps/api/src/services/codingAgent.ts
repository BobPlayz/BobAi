import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_TASK_LENGTH = 20_000;

export function isCodingTask(text: string) {
  return /\b(write|build|create|fix|debug|refactor|implement|code|coding|program|function|component|api|endpoint|typescript|javascript|python|react|next\.js|css|html)\b/i.test(text);
}

export async function runCodingAgent(task: string) {
  const normalizedTask = task.trim();

  if (!normalizedTask) {
    throw new Error("coding task is empty");
  }

  if (normalizedTask.length > MAX_TASK_LENGTH) {
    throw new Error(`coding task cannot exceed ${MAX_TASK_LENGTH} characters`);
  }

  const agentDirectory = process.env.BOBAI_CODING_AGENTS_DIR;

  if (!agentDirectory) {
    throw new Error("coding agent bridge is not configured");
  }

  const { stdout, stderr } = await execFileAsync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", normalizedTask],
    {
      cwd: agentDirectory,
      timeout: 5 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    }
  );

  return { output: stdout.trim(), warnings: stderr.trim() };
}
