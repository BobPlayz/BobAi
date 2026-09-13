import { randomUUID } from "node:crypto";

export type OrchestrationStatus = "queued" | "planning" | "coding" | "executing" | "reviewing" | "completed" | "failed";
export type AgentMessage = { id: string; from: "alex" | "ben" | "ryan"; to: "ben" | "ryan" | "bob"; content: string; createdAt: string };
export type CodingOrchestration = { id: string; task: string; status: OrchestrationStatus; messages: AgentMessage[]; error?: string; createdAt: string; completedAt?: string };
const runs = new Map<string, CodingOrchestration>();
export function getCodingOrchestration(id: string) { return runs.get(id); }
export function listCodingOrchestrations() { return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export async function runCodingOrchestration(task: string): Promise<CodingOrchestration> {
  const normalized = task.trim();
  if (!normalized) throw new Error("coding orchestration task is empty");
  throw new Error("legacy coding orchestration is no longer available; use the unified Bob coding path");
}
export function createLegacyOrchestrationRecord(task: string): CodingOrchestration {
  const now = new Date().toISOString();
  const run: CodingOrchestration = { id: randomUUID(), task: task.trim(), status: "failed", messages: [], error: "legacy coding orchestration is no longer available", createdAt: now, completedAt: now };
  runs.set(run.id, run);
  return run;
}
