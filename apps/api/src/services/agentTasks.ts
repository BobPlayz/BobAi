import { randomUUID } from "node:crypto";
import { runCodingAgent } from "./codingAgent.js";
import { generateImages } from "./mediaGeneration.js";
import { persistAgentTask, updatePersistedAgentTask } from "../store/agentTaskDb.js";
import { officeAgentFromTask, updateOfficeAgent } from "./agentOffice.js";
import { buildSkillInstruction, getAgentSkill, inferAgentSkills, normalizeAgentMode, type AgentMode, type AgentSkillId } from "./agentSkills.js";

export type AgentTaskKind = "coding" | "automation" | "project" | "media" | "database";
export type AgentTaskStatus = "queued" | "running" | "completed" | "failed";
export type AgentTask = { id: string; kind: AgentTaskKind; mode: AgentMode; skills: AgentSkillId[]; title: string; description: string; status: AgentTaskStatus; createdAt: string; startedAt?: string; completedAt?: string; result?: { output: string; warnings: string }; error?: string };
const tasks = new Map<string, AgentTask>();

function classifyTask(text: string): AgentTaskKind {
  const skills = inferAgentSkills(text);
  if (skills.includes("video_generation") || skills.includes("image_generation")) return "media";
  if (skills.includes("bobdb")) return "database";
  if (skills.includes("automation")) return "automation";
  if (/\b(project|architecture|bobauth|bobstorage|bobapi|bobhs)\b/i.test(text)) return "project";
  return "coding";
}
export function classifyAgentTask(text: string) { return classifyTask(text.trim()); }
export function getAgentTask(id: string) { return tasks.get(id); }
export function listAgentTasks() { return [...tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

function buildInstruction(kind: AgentTaskKind, description: string, skills: AgentSkillId[], mode: AgentMode) {
  const rules = kind === "automation"
    ? "Break the automation into concrete, verifiable steps. Implement only configured integrations and verify the result."
    : kind === "database"
      ? "Treat BobDB as a separate service. Reuse existing BobAI service boundaries and never invent an undocumented BobDB API."
      : kind === "media"
        ? "Use only actually configured media providers. Never fabricate generated media URLs or claim generation succeeded when unavailable."
        : "Inspect the existing repository first, preserve working functionality, avoid duplicate implementations, and run relevant checks after changes.";

  const lifecycle = [
    "ENGINEERING LIFECYCLE: perform this as one automated workflow, not a sequence of user-facing commands.",
    "1. INSPECT: inspect the existing implementation, tests, schemas, security rules, and relevant configuration before editing.",
    "2. PLAN: form a minimal implementation plan and identify files that actually need changes.",
    "3. IMPLEMENT: make the smallest safe change and preserve unrelated code.",
    "4. SECURITY REVIEW: review authentication, authorization, workspace isolation, input validation, secrets, SSRF, path traversal, command execution, prompt/output trust, permissions, rate limits, and error leakage. Fix code-side findings before continuing.",
    "5. VERIFY: run relevant tests, type checks, and build checks. If a check fails because of your changes, fix it and verify again.",
    "6. FINAL REVIEW: inspect the resulting diff for regressions, unnecessary code, duplicate implementations, and unfinished placeholders.",
    "Never claim a test, security review, provider call, or deployment succeeded unless it actually succeeded. If something requires a user's environment or credentials, report that as a blocker instead of fabricating success.",
  ].join("\n");

  return [lifecycle, buildSkillInstruction(skills, mode), rules, `Task: ${description}`].join("\n\n");
}

export async function executeAgentTask(description: string, requestedKind?: AgentTaskKind, requestedSkills?: AgentSkillId[], requestedMode?: string, context?: { workspaceId?: string; createdBy?: string }) {
  const normalized = description.trim();
  if (!normalized) throw new Error("task is required");
  if (normalized.length > 20_000) throw new Error("task cannot exceed 20000 characters");
  const mode = normalizeAgentMode(requestedMode);
  const skills = [...new Set(requestedSkills?.length ? requestedSkills : inferAgentSkills(normalized))];
  for (const skillId of skills) {
    const skill = getAgentSkill(skillId);
    if (!skill) throw new Error(`unknown agent skill: ${skillId}`);
    if (!skill.available) throw new Error(`agent skill is not configured: ${skillId}`);
  }
  const kind = requestedKind || classifyTask(normalized);
  const task: AgentTask = { id: randomUUID(), kind, mode, skills, title: normalized.slice(0, 120), description: normalized, status: "queued", createdAt: new Date().toISOString() };
  tasks.set(task.id, task);
  await persistAgentTask({ id: task.id, workspaceId: context?.workspaceId, createdBy: context?.createdBy, title: task.title, description: task.description, type: task.kind, status: task.status, payload: { mode: task.mode, skills: task.skills } }).catch(() => false);
  const officeAgent = officeAgentFromTask(task);
  task.status = "running";
  task.startedAt = new Date().toISOString();
  await updatePersistedAgentTask({ id: task.id, status: task.status }).catch(() => false);
  try {
    if (kind === "media" && skills.length === 1 && skills[0] === "image_generation") {
      updateOfficeAgent(officeAgent.id, { status: "creating", location: "media studio", activity: "generating image" });
      const images = await generateImages(normalized);
      task.status = "completed"; task.completedAt = new Date().toISOString(); task.result = { output: JSON.stringify({ images }), warnings: "" };
      updateOfficeAgent(officeAgent.id, { status: "completed", location: "team board", activity: "task completed" });
      await updatePersistedAgentTask({ id: task.id, status: task.status, result: task.result }).catch(() => false);
      return task;
    }
    updateOfficeAgent(officeAgent.id, { status: "coding", location: "coding workstation", activity: "running automated engineering lifecycle" });
    const result = await runCodingAgent(buildInstruction(kind, normalized, skills, mode));
    task.status = "completed"; task.completedAt = new Date().toISOString(); task.result = result;
    updateOfficeAgent(officeAgent.id, { status: "completed", location: "team board", activity: "implemented, reviewed, and verified" });
    await updatePersistedAgentTask({ id: task.id, status: task.status, result }).catch(() => false);
    return task;
  } catch (error) {
    task.status = "failed"; task.completedAt = new Date().toISOString(); task.error = error instanceof Error ? error.message : "agent task failed";
    updateOfficeAgent(officeAgent.id, { status: "failed", location: "team board", activity: task.error });
    await updatePersistedAgentTask({ id: task.id, status: task.status, error: task.error }).catch(() => false);
    throw Object.assign(new Error(task.error), { task });
  }
}
