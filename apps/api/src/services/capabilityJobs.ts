import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { tasks } from "@bobai/db";
import { executeProviderCapability, type ProviderCapability } from "./capabilityProviders.js";
import { persistAgentTask, updatePersistedAgentTask } from "../store/agentTaskDb.js";

type CapabilityJob = {
  id: string;
  capability: ProviderCapability;
  workspaceId: string;
  createdBy: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
};

const activeJobs = new Map<string, CapabilityJob>();

export function getActiveCapabilityJob(id: string, userId: string) {
  const job = activeJobs.get(id);
  return job?.createdBy === userId ? job : undefined;
}

export async function getPersistedCapabilityJob(id: string, userId: string) {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const module = await import("@bobai/db");
    const rows = await module.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.createdBy, userId))).limit(1);
    const task = rows[0];
    if (!task || !task.type.startsWith("capability:")) return undefined;
    const payload = (task.payload && typeof task.payload === "object") ? task.payload as Record<string, unknown> : {};
    return {
      id: task.id,
      capability: task.type.slice("capability:".length),
      status: task.status,
      createdAt: task.createdAt?.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      result: task.result,
      error: typeof (task.metadata as Record<string, unknown> | null)?.error === "string" ? (task.metadata as Record<string, unknown>).error : undefined,
      workspaceId: task.workspaceId,
      input: payload.input,
    };
  } catch {
    return undefined;
  }
}

export async function createCapabilityJob(
  capability: ProviderCapability,
  input: Record<string, unknown>,
  context: { workspaceId: string; createdBy: string },
) {
  const now = new Date().toISOString();
  const job: CapabilityJob = {
    id: randomUUID(), capability, workspaceId: context.workspaceId, createdBy: context.createdBy,
    status: "queued", createdAt: now,
  };
  activeJobs.set(job.id, job);

  await persistAgentTask({
    id: job.id,
    workspaceId: context.workspaceId,
    createdBy: context.createdBy,
    title: `${capability} job`,
    description: `Execute ${capability}`,
    type: `capability:${capability}`,
    status: "queued",
    payload: { input },
  }).catch(() => false);

  void runCapabilityJob(job, input);
  return job;
}

async function runCapabilityJob(job: CapabilityJob, input: Record<string, unknown>) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  await updatePersistedAgentTask({ id: job.id, status: "running" }).catch(() => false);
  try {
    job.result = await executeProviderCapability(job.capability, input);
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    await updatePersistedAgentTask({ id: job.id, status: "completed", result: job.result }).catch(() => false);
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : "capability job failed";
    await updatePersistedAgentTask({ id: job.id, status: "failed", error: job.error }).catch(() => false);
  }
}
