import { Router } from "express";
import { runCodingAgent } from "../services/codingAgent.js";

const router = Router();

router.post("/run", async (req, res) => {
  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";

  if (!task) {
    return res.status(400).json({ error: "task is required" });
  }

  try {
    res.json(await runCodingAgent(task));
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    res.status(502).json({ error: detail.message || "coding agent failed", output: detail.stdout?.trim() || "", warnings: detail.stderr?.trim() || "" });
  }
});

export default router;