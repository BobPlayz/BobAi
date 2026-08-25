import { randomUUID } from "node:crypto";
import { runCodingAgent } from "./codingAgent.js";

export type AgentTaskKind = "coding" | "automation" | "project";

export type AgentTaskStatus = "queued" | "running" | "completed" | "failed";

export type AgentTask = {
  id: string;
  kind: AgentTaskKind;
  title: string;
  description: string;
  status: AgentTaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: {
    output: string;
    warnings: string;
  };
  error?: string;
};

const tasks = new Map<string, AgentTask>();

const AUTOMATION_PATTERNS = [
  /\bautomate\b/i,
  /\bautomation\b/i,
  /\bautomatically\b/i,
  /\bset up .* workflow\b/i,
  /\bworkflow\b/i,
  /\bschedule\b/i,
  /\brecurring\b/i,
];

const PROJECT_PATTERNS = [
  /\bcreate\s+(bobdb|bob\s*db)\b/i,
  /\bbuild\s+(bobdb|bob\s*db)\b/i,
  /\bcreate\s+(bobauth|bob\s*auth)\b/i,
  /\bcreate\s+(bobstorage|bob\s*storage)\b/i,
  /\bcreate\s+(bobapi|bob\s*api)\b/i,
  /\bcreate\s+(bobhs|bob\s*hs)\b/i,
  /\bproject\b/i,
  /\barchitecture\b/i,
];

function classifyTask(text: string): AgentTaskKind {
  if (AUTOMATION_PATTERNS.some((pattern) => pattern.test(text))) return "automation";
  if (PROJECT_PATTERNS.some((pattern) => pattern.test(text))) return "project";
  return "coding";
}

function buildAgentInstruction(kind: AgentTaskKind, description: string) {
  if (kind === "automation") {
    return [
      "You are executing a BobAI automation task.",
      "Do not invent external integrations that are not available in the repository.",
      "Inspect the existing project first.",
      "Break the requested automation into concrete, verifiable steps.",
      "Implement the steps that can be completed safely in the configured coding-agent workspace.",
      "Run relevant checks after changes and report anything that could not be completed.",
      `Task: ${description}`,
    ].join("\n\n");
  }

  if (kind === "project") {
    return [
      "You are executing a BobAI project/architecture task.",
      "Inspect the existing repository and reuse existing architecture before creating new systems.",
      "Preserve working functionality and avoid duplicate implementations.",
      "For BobDB, BobAuth, BobStorage, BobAPI, BobHS, or related Bob services, implement only what the repository and task actually require; do not fabricate APIs or dependencies.",
      "Run relevant checks after changes and report anything that remains incomplete.",
      `Task: ${description}`,
    ].join("\n\n");
  }

  return description;
}

export function classifyAgentTask(text: string): AgentTaskKind {
  return classifyTask(text.trim());
}

export function getAgentTask(id: string) {
  return tasks.get(id);
}

export function listAgentTasks() {
  return [...tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function executeAgentTask(description: string, requestedKind?: AgentTaskKind) {
  const normalized = description.trim();
  if (!normalized) throw new Error("task is required");
  if (normalized.length > 20_000) throw new Error("task cannot exceed 20000 characters");

  const kind = requestedKind || classifyTask(normalized);
  const task: AgentTask = {
    id: randomUUID(),
    kind,
    title: normalized.slice(0, 120),
    description: normalized,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  task.status = "running";
  task.startedAt = new Date().toISOString();

  try {
    const result = await runCodingAgent(buildAgentInstruction(kind, normalized));
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.result = result;
    return task;
  } catch (error) {
    task.status = "failed";
    task.completedAt = new Date().toISOString();
    task.error = error instanceof Error ? error.message : "agent task failed";
    throw Object.assign(new Error(task.error), { task });
  }
}
