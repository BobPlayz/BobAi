import { randomUUID } from "node:crypto";
import { executeAgentTask, type AgentTaskKind } from "./agentTasks.js";
import type { AgentSkillId } from "./agentSkills.js";

export type QueueJob = {
  id: string;
  description: string;
  kind?: AgentTaskKind;
  skills?: AgentSkillId[];
  mode?: string;
  context?: { workspaceId?: string; createdBy?: string };
  attempts: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  result?: unknown;
  error?: string;
};

const queue: QueueJob[] = [];
const jobs = new Map<string, QueueJob>();
let running = 0;

// Agents are available simultaneously, but only the workers needed by queued
// work are started. One worker is the safe default for a local machine.
const concurrency = Math.max(1, Math.min(4, Number(process.env.BOBAI_AGENT_CONCURRENCY || 1)));
const maxAttempts = Math.max(1, Math.min(5, Number(process.env.BOBAI_AGENT_MAX_ATTEMPTS || 2)));

export function enqueueAgentTask(input: Omit<QueueJob, "id" | "attempts" | "status" | "createdAt">) {
  if (queue.length >= 100) throw new Error("agent queue is full");
  const job: QueueJob = {
    ...input,
    id: randomUUID(),
    attempts: 0,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  queue.push(job);
  jobs.set(job.id, job);
  void drain();
  return job;
}

export function getQueueJob(id: string) {
  return jobs.get(id) || null;
}

export function listQueueJobs() {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function drain() {
  while (running < concurrency) {
    const job = queue.find((candidate) => candidate.status === "queued");
    if (!job) return;
    job.status = "running";
    job.attempts += 1;
    running += 1;
    void run(job).finally(() => {
      running -= 1;
      void drain();
    });
  }
}

async function run(job: QueueJob) {
  try {
    job.result = await executeAgentTask(job.description, job.kind, job.skills, job.mode, job.context);
    job.status = "completed";
  } catch (error) {
    job.error = error instanceof Error ? error.message : "agent execution failed";
    if (job.attempts < maxAttempts) {
      job.status = "queued";
      queue.push(job);
    } else {
      job.status = "failed";
    }
  }
}
