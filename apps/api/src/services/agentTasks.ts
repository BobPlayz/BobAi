import { randomUUID } from "node:crypto";
import { runCodingAgent } from "./codingAgent.js";
import { generateImages } from "./mediaGeneration.js";
import {
  buildSkillInstruction,
  getAgentSkill,
  inferAgentSkills,
  normalizeAgentMode,
  type AgentMode,
  type AgentSkillId,
} from "./agentSkills.js";

export type AgentTaskKind = "coding" | "automation" | "project" | "media" | "database";
export type AgentTaskStatus = "queued" | "running" | "completed" | "failed";

export type AgentTask = {
  id: string;
  kind: AgentTaskKind;
  mode: AgentMode;
  skills: AgentSkillId[];
  title: string;
  description: string;
  status: AgentTaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: { output: string; warnings: string };
  error?: string;
};

const tasks = new Map<string, AgentTask>();

function classifyTask(text: string): AgentTaskKind {
  const skills = inferAgentSkills(text);
  if (skills.includes("video_generation") || skills.includes("image_generation")) return "media";
  if (skills.includes("bobdb")) return "database";
  if (skills.includes("automation")) return "automation";
  if (/\b(project|architecture|bobauth|bobstorage|bobapi|bobhs)\b/i.test(text)) return "project";
  return "coding";
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

function buildInstruction(kind: AgentTaskKind, description: string, skills: AgentSkillId[], mode: AgentMode) {
  const header = buildSkillInstruction(skills, mode);
  const taskRules = kind === "automation"
    ? "Break the automation into concrete, verifiable steps. Implement only configured integrations and verify the result."
    : kind === "database"
      ? "Treat BobDB as a separate service. Reuse existing BobAI service boundaries and do not invent an undocumented BobDB API. If BobDB is not configured, implement the integration boundary or project changes without pretending a live operation succeeded."
      : kind === "media"
        ? "For media work, use an actually configured provider. Do not fabricate generated media URLs or claim generation succeeded when the provider is unavailable."
        : "Inspect the existing repository first, preserve working functionality, avoid duplicate implementations, and run relevant checks after changes.";

  return [header, taskRules, `Task: ${description}`].join("\n\n");
}

export async function executeAgentTask(
  description: string,
  requestedKind?: AgentTaskKind,
  requestedSkills?: AgentSkillId[],
  requestedMode?: string,
) {
  const normalized = description.trim();
  if (!normalized) throw new Error("task is required");
  if (normalized.length > 20_000) throw new Error("task cannot exceed 20000 characters");

  const mode = normalizeAgentMode(requestedMode);
  const inferred = inferAgentSkills(normalized);
  const skills = [...new Set(requestedSkills?.length ? requestedSkills : inferred)];

  for (const skillId of skills) {
    const skill = getAgentSkill(skillId);
    if (!skill) throw new Error(`unknown agent skill: ${skillId}`);
    if (!skill.available) throw new Error(`agent skill is not configured: ${skillId}`);
  }

  const kind = requestedKind || classifyTask(normalized);
  const task: AgentTask = {
    id: randomUUID(),
    kind,
    mode,
    skills,
    title: normalized.slice(0, 120),
    description: normalized,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  task.status = "running";
  task.startedAt = new Date().toISOString();

  try {
    if (kind === "media" && skills.length === 1 && skills[0] === "image_generation") {
      const images = await generateImages(normalized);
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      task.result = { output: JSON.stringify({ images }), warnings: "" };
      return task;
    }

    const result = await runCodingAgent(buildInstruction(kind, normalized, skills, mode));
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
