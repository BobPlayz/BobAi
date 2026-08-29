import crypto from "node:crypto";

type JobStatus = "queued" | "processing" | "completed" | "failed";

export type CapabilityJob = {
  id: string;
  capability: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
};

const jobs = new Map<string, CapabilityJob>();

export function createCapabilityJob(capability: string): CapabilityJob {
  const now = new Date().toISOString();
  const job: CapabilityJob = {
    id: crypto.randomUUID(),
    capability,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  return job;
}

export function getCapabilityJob(id: string) {
  return jobs.get(id);
}

export function updateCapabilityJob(id: string, patch: Partial<CapabilityJob>) {
  const current = jobs.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(id, next);
  return next;
}
