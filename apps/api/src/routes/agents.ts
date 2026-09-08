import { Router } from "express";
import { classifyAgentTask, getAgentTask, listAgentTasks, type AgentTaskKind } from "../services/agentTasks.js";
import { listAgentSkills, type AgentSkillId } from "../services/agentSkills.js";
import { listBobServices } from "../services/bobServices.js";
import { agentAuth } from "../middleware/agentAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { enqueueAgentTask, getQueueJob, listQueueJobs } from "../services/taskQueue.js";
import { resolveUserWorkspace } from "../services/workspace.js";
import { getPersistedAgentTask } from "../store/agentTaskDb.js";

const router = Router();
const allowedKinds: AgentTaskKind[] = ["coding", "automation", "project", "media", "database"];
const userBuckets = new Map<string, { startedAt: number; count: number }>();
const USER_WINDOW_MS = 60_000;
const USER_MAX_REQUESTS = 5;

type TaskBody = { task?: unknown; kind?: unknown; mode?: unknown; skills?: unknown; workspaceId?: unknown };

function parseTaskBody(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as TaskBody;
  const description = typeof input.task === "string" ? input.task.trim() : "";
  const requestedKind = typeof input.kind === "string" ? input.kind : undefined;
  const requestedMode = typeof input.mode === "string" ? input.mode : undefined;
  const requestedSkills = Array.isArray(input.skills) ? input.skills.filter((value): value is AgentSkillId => typeof value === "string") : undefined;
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

function userLimited(userId: string) {
  const now = Date.now();
  const current = userBuckets.get(userId);
  if (!current || now - current.startedAt >= USER_WINDOW_MS) {
    userBuckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > USER_MAX_REQUESTS;
}

const cleanup = setInterval(() => {
  const cutoff = Date.now() - USER_WINDOW_MS;
  for (const [key, bucket] of userBuckets) if (bucket.startedAt < cutoff) userBuckets.delete(key);
}, USER_WINDOW_MS);
cleanup.unref();

router.get("/skills", agentAuth, (_req, res) => res.json({ skills: listAgentSkills() }));
router.get("/services", agentAuth, (_req, res) => res.json({ services: listBobServices() }));
router.get("/tasks", agentAuth, (_req, res) => res.json({ tasks: listAgentTasks() }));
router.get("/tasks/:id", agentAuth, (req, res) => {
  const task = getAgentTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "agent task not found" });
  return res.json(task);
});
router.get("/queue", agentAuth, (_req, res) => res.json({ jobs: listQueueJobs() }));
router.get("/queue/:id", agentAuth, (req, res) => {
  const job = getQueueJob(req.params.id as string);
  if (!job) return res.status(404).json({ error: "queue job not found" });
  return res.json(job);
});

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

router.post("/user/run", requireAuth, async (req, res) => {
  if (userLimited(req.user!.id)) return res.status(429).json({ error: "too many agent requests", retryAfterSeconds: 60 });
  const validated = validateTask(req.body);
  if ("error" in validated) return res.status(validated.error === "task is required" ? 400 : 413).json(validated);

  try {
    const workspace = await resolveUserWorkspace(req.user!.id, validated.value.workspaceId);
    if (!workspace) return res.status(403).json({ error: "workspace access denied" });

    const job = enqueueAgentTask({
      description: validated.value.description,
      kind: validated.value.requestedKind as AgentTaskKind | undefined,
      skills: validated.value.requestedSkills,
      mode: validated.value.requestedMode,
      context: { workspaceId: workspace.id, createdBy: req.user!.id },
    });
    return res.status(202).json({ id: job.id, status: job.status, createdAt: job.createdAt, agent: "background", workspaceId: workspace.id });
  } catch (error) {
    return res.status(429).json({ error: error instanceof Error ? error.message : "agent queue unavailable" });
  }
});

router.get("/user/queue/:id", requireAuth, async (req, res) => {
  const job = getQueueJob(req.params.id as string);
  if (job) {
    if (job.context?.createdBy !== req.user!.id) return res.status(404).json({ error: "agent job not found" });
    return res.json({ id: job.id, status: job.status, createdAt: job.createdAt, result: job.result, error: job.error, workspaceId: job.context?.workspaceId });
  }

  try {
    const task = await getPersistedAgentTask(req.params.id as string, req.user!.id);
    if (!task) return res.status(404).json({ error: "agent job not found" });
    const metadata = task.metadata && typeof task.metadata === "object" ? task.metadata as Record<string, unknown> : {};
    return res.json({
      id: task.id,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      result: task.result,
      error: typeof metadata.error === "string" ? metadata.error : undefined,
      workspaceId: task.workspaceId,
    });
  } catch {
    return res.status(503).json({ error: "agent task storage unavailable" });
  }
});

export default router;
