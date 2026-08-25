import { Router } from "express";
import { runCodingAgent } from "../services/codingAgent.js";
import {
  classifyAgentTask,
  executeAgentTask,
  getAgentTask,
  listAgentTasks,
  type AgentTaskKind,
} from "../services/agentTasks.js";
import { listAgentSkills, type AgentSkillId } from "../services/agentSkills.js";

const router = Router();

router.get("/skills", (_req, res) => {
  return res.json({ skills: listAgentSkills() });
});

router.get("/tasks", (_req, res) => {
  return res.json({ tasks: listAgentTasks() });
});

router.get("/tasks/:id", (req, res) => {
  const task = getAgentTask(req.params.id);
  if (!task) return res.status(404).json({ error: "agent task not found" });
  return res.json(task);
});

router.post("/tasks", async (req, res) => {
  if (!process.env.BOBAI_CODING_AGENTS_DIR) {
    return res.status(503).json({ error: "coding agent bridge is not configured" });
  }

  const description = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  const requestedKind = typeof req.body?.kind === "string" ? req.body.kind : undefined;
  const requestedMode = typeof req.body?.mode === "string" ? req.body.mode : undefined;
  const requestedSkills = Array.isArray(req.body?.skills)
    ? req.body.skills.filter((value: unknown): value is AgentSkillId => typeof value === "string")
    : undefined;

  if (!description) return res.status(400).json({ error: "task is required" });

  const allowedKinds: AgentTaskKind[] = ["coding", "automation", "project", "media", "database"];
  if (requestedKind && !allowedKinds.includes(requestedKind as AgentTaskKind)) {
    return res.status(400).json({ error: "invalid task kind" });
  }

  try {
    const task = await executeAgentTask(
      description,
      requestedKind as AgentTaskKind | undefined,
      requestedSkills,
      requestedMode,
    );
    return res.status(201).json(task);
  } catch (error) {
    const detail = error as { message?: string; task?: unknown };
    return res.status(502).json({
      error: detail.message || "agent task failed",
      task: detail.task || null,
    });
  }
});

router.post("/classify", (req, res) => {
  const text = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!text) return res.status(400).json({ error: "task is required" });
  return res.json({ kind: classifyAgentTask(text) });
});

router.post("/run", async (req, res) => {
  if (!process.env.BOBAI_CODING_AGENTS_DIR) {
    return res.status(503).json({ error: "coding agent bridge is not configured" });
  }

  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!task) return res.status(400).json({ error: "task is required" });

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
