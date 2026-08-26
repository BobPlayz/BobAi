import { Router } from "express";
import { classifyAgentTask, getAgentTask, listAgentTasks, type AgentTaskKind } from "../services/agentTasks.js";
import { listAgentSkills, type AgentSkillId } from "../services/agentSkills.js";
import { listBobServices } from "../services/bobServices.js";
import { agentAuth } from "../middleware/agentAuth.js";
import { enqueueAgentTask, getQueueJob, listQueueJobs } from "../services/taskQueue.js";

const router = Router();
const allowedKinds: AgentTaskKind[] = ["coding", "automation", "project", "media", "database"];

type TaskBody = { task?: unknown; kind?: unknown; mode?: unknown; skills?: unknown; workspaceId?: unknown };

function parseTaskBody(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as TaskBody;
  const description = typeof input.task === "string" ? input.task.trim() : "";
  const requestedKind = typeof input.kind === "string" ? input.kind : undefined;
  const requestedMode = typeof input.mode === "string" ? input.mode : undefined;
  const requestedSkills = Array.isArray(input.skills)
    ? input.skills.filter((value): value is AgentSkillId => typeof value === "string")
    : undefined;
  const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId.trim().slice(0, 200) : undefined;
  return { description, requestedKind, requestedMode, requestedSkills, workspaceId };
}

function validateTask(body: unknown) {
  const parsed = parseTaskBody(body);
  if (!parsed.description) return { error: "task is required" } as const;
  if (parsed.description.length > 20_000) return { error: "task cannot exceed 20000 characters" } as const;
  if (parsed.requestedKind && !allowedKinds.includes(parsed.requestedKind as AgentTaskKind)) return { error: "invalid task kind" } as const;
  return { value: parsed } as const;
}

router.get("/skills", agentAuth, (_req, res) => res.json({ skills: listAgentSkills() }));
router.get("/services", agentAuth, (_req, res) => res.json({ services: listBobServices() }));
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

// Specialist agents are always background workers. They never become a second
// conversational voice and never execute synchronously through the API.
router.post("/tasks", agentAuth, (req, res) => {
  const validated = validateTask(req.body);
  if ("error" in validated) return res.status(validated.error === "task is required" ? 400 : 413).json(validated);
  const { description, requestedKind, requestedMode, requestedSkills, workspaceId } = validated.value;
  try {
    const job = enqueueAgentTask({ description, kind: requestedKind as AgentTaskKind | undefined, skills: requestedSkills, mode: requestedMode, context: { workspaceId } });
    return res.status(202).json({ id: job.id, status: job.status, createdAt: job.createdAt, agent: "background" });
  } catch (error) {
    return res.status(429).json({ error: error instanceof Error ? error.message : "agent queue unavailable" });
  }
});

router.post("/classify", agentAuth, (req, res) => {
  const validated = validateTask(req.body);
  if ("error" in validated) return res.status(validated.error === "task is required" ? 400 : 413).json(validated);
  return res.json({ kind: classifyAgentTask(validated.value.description) });
});

// Kept as a compatibility endpoint, but it now queues instead of executing a
// coding agent inline. This prevents accidental local resource spikes.
router.post("/run", agentAuth, (req, res) => {
  const validated = validateTask(req.body);
  if ("error" in validated) return res.status(validated.error === "task is required" ? 400 : 413).json(validated);
  try {
    const job = enqueueAgentTask({ description: validated.value.description, kind: "coding", mode: validated.value.requestedMode, context: { workspaceId: validated.value.workspaceId } });
    return res.status(202).json({ id: job.id, status: job.status, agent: "background" });
  } catch (error) {
    return res.status(429).json({ error: error instanceof Error ? error.message : "agent queue unavailable" });
  }
});

export default router;
