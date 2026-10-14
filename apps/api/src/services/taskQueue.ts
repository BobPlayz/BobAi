import { randomUUID } from "node:crypto";
import { executeAgentTask, cancelAgentTask, type AgentTaskKind } from "./agentTasks.js";
import type { AgentSkillId } from "./agentSkills.js";
import { claimPersistedAgentTask, recoverAgentTasks, persistAgentTask, touchPersistedAgentTask, updatePersistedAgentTask } from "../store/agentTaskDb.js";
import type { AgentBudget, AgentStep } from "./agentOrchestration.js";
export type QueueJob = { id: string; description: string; kind?: AgentTaskKind; skills?: AgentSkillId[]; mode?: string; context?: { workspaceId?: string; createdBy?: string; plan?: AgentStep[]; budget?: Partial<AgentBudget>; checkpointToken?: string; taskId?: string }; attempts: number; status: "queued" | "running" | "completed" | "failed" | "cancelled" | "waiting"; createdAt: string; result?: unknown; error?: string };
const queue: QueueJob[] = []; const jobs = new Map<string, QueueJob>(); const pendingPersistence = new Set<string>(); let running = 0;
const concurrency = Math.max(1, Math.min(4, Number(process.env.BOBAI_AGENT_CONCURRENCY || 1))); const maxAttempts = Math.max(1, Math.min(5, Number(process.env.BOBAI_AGENT_MAX_ATTEMPTS || 2)));
export function enqueueAgentTask(input: Omit<QueueJob, "id" | "attempts" | "status" | "createdAt">) { if (queue.length >= 100) throw new Error("agent queue is full"); const job: QueueJob = { ...input, id: randomUUID(), attempts: 0, status: "queued", createdAt: new Date().toISOString(), context: { ...input.context, taskId: undefined } }; job.context = { ...job.context, taskId: job.id }; queue.push(job); jobs.set(job.id, job); pendingPersistence.add(job.id); void persistAgentTask({ id: job.id, workspaceId: job.context?.workspaceId, createdBy: job.context?.createdBy, title: job.description.slice(0, 120), description: job.description, type: job.kind || "coding", status: "queued", payload: { mode: job.mode, skills: job.skills, budget: job.context?.budget, checkpointToken: job.context?.checkpointToken } }).then((persisted) => { if (!persisted && process.env.DATABASE_URL && job.context?.workspaceId && job.status === "queued") { job.status = "failed"; job.error = "agent task could not be persisted"; } }).catch(() => { if (process.env.DATABASE_URL && job.context?.workspaceId && job.status === "queued") { job.status = "failed"; job.error = "agent task could not be persisted"; } }).finally(() => { pendingPersistence.delete(job.id); void drain(); }); return job; }
export function getQueueJob(id: string) { return jobs.get(id) || null; }
export function listQueueJobs() { return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function cancelQueueJob(id: string) { const job = jobs.get(id); if (!job || !["queued", "running", "waiting"].includes(job.status)) return false; if (job.status === "running") cancelAgentTask(job.id); job.status = "cancelled"; job.error = "agent task cancelled"; void updatePersistedAgentTask({ id: job.id, status: "cancelled", error: job.error }).catch(() => undefined); return true; }
export function wakeAgentQueue() { void drain(); }
async function recoverPersistedJobs() {
  try {
    const persisted = await recoverAgentTasks();
    for (const task of persisted) {
      if (!task.description || jobs.has(task.id)) continue;
      const payload = task.payload && typeof task.payload === "object" && !Array.isArray(task.payload) ? task.payload as Record<string, unknown> : {};
      const skills = Array.isArray(payload.skills) ? payload.skills.filter((value): value is AgentSkillId => typeof value === "string") : undefined;
      const mode = typeof payload.mode === "string" ? payload.mode : undefined;
      const kind = ["coding", "automation", "project", "media", "database"].includes(task.type) ? task.type as AgentTaskKind : undefined;
      const job: QueueJob = { id: task.id, description: task.description, kind, skills, mode, context: { taskId: task.id, workspaceId: task.workspaceId, createdBy: task.createdBy ?? undefined, plan: Array.isArray(payload.plan) ? payload.plan as AgentStep[] : undefined, budget: payload.budget && typeof payload.budget === "object" && !Array.isArray(payload.budget) ? payload.budget as Partial<AgentBudget> : undefined, checkpointToken: typeof payload.checkpointToken === "string" ? payload.checkpointToken : undefined }, attempts: 0, status: "queued", createdAt: task.createdAt.toISOString() };
      jobs.set(job.id, job);
      queue.push(job);
    }
  } catch (error) {
    console.error("agent queue recovery failed", error);
  }
}
const recoveryPromise = recoverPersistedJobs();
const recoveryTimer = setInterval(() => { void recoverPersistedJobs().then(() => drain()); }, 30_000); recoveryTimer.unref();
async function drain() { await recoveryPromise; while (running < concurrency) { const index = queue.findIndex((candidate) => candidate.status === "queued" && !pendingPersistence.has(candidate.id)); if (index === -1) return; const [job] = queue.splice(index, 1); if (!job || job.status !== "queued") continue; job.status = "running"; job.attempts += 1; running += 1; void run(job).finally(() => { running -= 1; void drain(); }); } }
async function run(job: QueueJob) {
  let heartbeat: NodeJS.Timeout | undefined;
  try {
    if (job.status === "cancelled") return;
    const durable = Boolean(process.env.DATABASE_URL && job.context?.workspaceId);
    const claimed = await claimPersistedAgentTask(job.id, durable).catch(() => false);
    if (!claimed) {
      jobs.delete(job.id);
      job.status = "cancelled";
      job.error = "agent task was already claimed or could not be claimed";
      return;
    }
    if (durable) {
      heartbeat = setInterval(() => { void touchPersistedAgentTask(job.id).catch(() => undefined); }, 30_000);
      heartbeat.unref();
    }
    if (job.status === "cancelled") return;
    job.result = await executeAgentTask(job.description, job.kind, job.skills, job.mode, job.context);
    if (job.status !== "cancelled") {
      job.status = "completed";
      await updatePersistedAgentTask({ id: job.id, status: "completed", result: job.result }).catch(() => undefined);
    }
  } catch (error) {
    if (job.status === "cancelled") return;
    job.error = error instanceof Error ? error.message : "agent execution failed";
    if (/checkpoint approval is required/i.test(job.error)) {
      job.status = "waiting";
      await updatePersistedAgentTask({ id: job.id, status: "waiting", error: job.error }).catch(() => undefined);
    } else if (job.attempts < maxAttempts) {
      job.status = "queued";
      await updatePersistedAgentTask({ id: job.id, status: "queued", error: job.error }).catch(() => undefined);
      queue.push(job);
    } else {
      job.status = "failed";
      await updatePersistedAgentTask({ id: job.id, status: "failed", error: job.error }).catch(() => undefined);
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
