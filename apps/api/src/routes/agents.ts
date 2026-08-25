import { Router } from "express";
import { runCodingAgent } from "../services/codingAgent.js";

const router = Router();

router.post("/run", async (req, res) => {
  if (!process.env.BOBAI_CODING_AGENTS_DIR) {
    return res.status(503).json({
      error: "coding agent bridge is not configured",
    });
  }

  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";

  if (!task) {
    return res.status(400).json({ error: "task is required" });
  }

  try {
    res.json(await runCodingAgent(task));
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    return res.status(502).json({
      error: detail.message || "coding agent failed",
      output: detail.stdout?.trim() || "",
      warnings: detail.stderr?.trim() || "",
    });
  }
});

export default router;
