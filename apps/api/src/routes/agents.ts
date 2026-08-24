import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Router } from "express";

const execFileAsync = promisify(execFile);
const router = Router();
const agentDirectory = process.env.BOBAI_CODING_AGENTS_DIR;

router.post("/run", async (req, res) => {
  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";

  if (!agentDirectory) {
    return res.status(503).json({ error: "coding agent bridge is not configured" });
  }

  if (!task) {
    return res.status(400).json({ error: "task is required" });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", task],
      { cwd: agentDirectory, timeout: 5 * 60 * 1000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }
    );

    res.json({ output: stdout.trim(), warnings: stderr.trim() });
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    res.status(502).json({ error: detail.message || "coding agent failed", output: detail.stdout?.trim() || "", warnings: detail.stderr?.trim() || "" });
  }
});

export default router;