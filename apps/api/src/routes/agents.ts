import { Router } from "express";
import { runCodingAgent } from "../services/codingAgent.js";
import { classifyAgentTask, executeAgentTask, getAgentTask, listAgentTasks, type AgentTaskKind } from "../services/agentTasks.js";
import { listAgentSkills, type AgentSkillId } from "../services/agentSkills.js";
import { listBobServices } from "../services/bobServices.js";
import { agentAuth } from "../middleware/agentAuth.js";
import { enqueueAgentTask, getQueueJob, listQueueJobs } from "../services/taskQueue.js";

const router = Router();
router.get("/skills", (_req, res) => res.json({ skills: listAgentSkills() }));
router.get("/services", (_req, res) => res.json({ services: listBobServices() }));
router.get("/tasks", agentAuth, (_req, res) => res.json({ tasks: listAgentTasks() }));
router.get("/tasks/:id", agentAuth, (req, res) => {
  const task = getAgentTask(req.params.id);
  if (!task) return res.status(404).json({ error: "agent task not found" });
  return res.json(task);
});
router.get("/queue", agentAuth, (_req, res) => res.json({ jobs: listQueueJobs() }));
router.get("/queue/:id", agentAuth, (req, res) => {
  const job = getQueueJob(req.params.id);
  if (!job) return res.status(404).json({ error: "queue job not found" });
  return res.json(job);
});

function parseTaskBody(body: any) {
  const description = typeof body?.task === "string" ? body.task.trim() : "";
  const requestedKind = typeof body?.kind === "string" ? body.kind : undefined;
  const requestedMode = typeof body?.mode === "string" ? body.mode : undefined;
  const requestedSkills = Array.isArray(body?.skills) ? body.skills.filter((value: unknown): value is AgentSkillId => typeof value === "string") : undefined;
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.slice(0, 200) : undefined;
  return { description, requestedKind, requestedMode, requestedSkills, workspaceId };
}

router.post("/tasks", agentAuth, async (req, res) => {
  const { description, requestedKind, requestedMode, requestedSkills, workspaceId } = parseTaskBody(req.body);
  const allowedKinds: AgentTaskKind[] = ["coding", "automation", "project", "media", "database"];
  if (!description) return res.status(400).json({ error: "task is required" });
  if (description.length > 20_000) return res.status(413).json({ error: "task cannot exceed 20000 characters" });
  if (requestedKind && !allowedKinds.includes(requestedKind as AgentTaskKind)) return res.status(400).json({ error: "invalid task kind" });
  try {
    const task = await executeAgentTask(description, requestedKind as AgentTaskKind | undefined, requestedSkills, requestedMode, { workspaceId });
    return res.status(201).json(task);
  } catch (error) {
    const detail = error as { message?: string; task?: unknown };
    return res.status(502).json({ error: detail.message || "agent task failed", task: detail.task || null });
  }
});

router.post("/tasks/queue", agentAuth, (req, res) => {
  const { description, requestedKind, requestedMode, requestedSkills, workspaceId } = parseTaskBody(req.body);
  const allowedKinds: AgentTaskKind[] = ["coding", "automation", "project", "media", "database"];
  if (!description) return res.status(400).json({ error: "task is required" });
  if (description.length > 20_000) return res.status(413).json({ error: "task cannot exceed 20000 characters" });
  if (requestedKind && !allowedKinds.includes(requestedKind as AgentTaskKind)) return res.status(400).json({ error: "invalid task kind" });
  try {
    const job = enqueueAgentTask({ description, kind: requestedKind as AgentTaskKind | undefined, skills: requestedSkills, mode: requestedMode, context: { workspaceId } });
    return res.status(202).json(job);
  } catch (error) {
    return res.status(429).json({ error: error instanceof Error ? error.message : "agent queue unavailable" });
  }
});

router.post("/classify", agentAuth, (req, res) => {
  const text = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!text) return res.status(400).json({ error: "task is required" });
  if (text.length > 20_000) return res.status(413).json({ error: "task cannot exceed 20000 characters" });
  return res.json({ kind: classifyAgentTask(text) });
});

router.post("/run", agentAuth, async (req, res) => {
  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!task) return res.status(400).json({ error: "task is required" });
  if (task.length > 20_000) return res.status(413).json({ error: "task cannot exceed 20000 characters" });
  try { return res.json(await runCodingAgent(task)); }
  catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : "coding agent failed" }); }
});
export default router;
