import { randomUUID } from "node:crypto";
import { AGENT_REGISTRY, getModelDefinition } from "./modelRegistry.js";
import { bobModelProvider } from "./modelProvider.js";
import { runCodingAgent } from "./codingAgent.js";

export type OrchestrationStatus = "queued" | "planning" | "coding" | "executing" | "reviewing" | "completed" | "failed";
export type AgentMessage = { id: string; from: "alex" | "ben" | "ryan"; to: "ben" | "ryan" | "bob"; content: string; createdAt: string };
export type CodingOrchestration = { id: string; task: string; status: OrchestrationStatus; messages: AgentMessage[]; plan?: string; implementation?: string; execution?: string; review?: string; error?: string; createdAt: string; completedAt?: string };
const runs = new Map<string, CodingOrchestration>();
function message(from: AgentMessage["from"], to: AgentMessage["to"], content: string): AgentMessage { return { id: randomUUID(), from, to, content, createdAt: new Date().toISOString() }; }
async function generateForAgent(agentId: "alex" | "ben" | "ryan", prompt: string, system: string) { const agent = AGENT_REGISTRY[agentId]; const model = agent.modelId ? getModelDefinition(agent.modelId) : undefined; if (!model || model.provider !== "coding" || !model.model) throw new Error(`${agent.name} model is not configured`); const result = await bobModelProvider.chat([{ role: "system", content: system }, { role: "user", content: prompt }], "coding", model.model); return result.content; }
export function getCodingOrchestration(id: string) { return runs.get(id); }
export function listCodingOrchestrations() { return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function runCodingOrchestration(task: string, maxReviewLoops = 2): Promise<CodingOrchestration> {
  const normalized = task.trim(); if (!normalized) throw new Error("coding orchestration task is empty"); if (normalized.length > 20_000) throw new Error("coding orchestration task cannot exceed 20000 characters");
  const reviewLoops = Math.min(3, Math.max(1, Math.floor(maxReviewLoops)));
  const run: CodingOrchestration = { id: randomUUID(), task: normalized, status: "queued", messages: [], createdAt: new Date().toISOString() }; runs.set(run.id, run);
  try {
    run.status = "planning";
    run.plan = await generateForAgent("alex", normalized, "You are Alex, BobAI's planner. Break the task into concrete implementation steps, acceptance checks, security risks, and rollback concerns. Do not claim files were changed.");
    run.messages.push(message("alex", "ben", run.plan));
    run.status = "coding";
    run.implementation = await generateForAgent("ben", `Task:\n${normalized}\n\nAlex's plan:\n${run.plan}`, "You are Ben, BobAI's coding specialist. Produce precise implementation instructions for the disposable coding executor. Do not claim you edited real files and do not invent repository state.");
    run.messages.push(message("ben", "ryan", run.implementation));

    let approved = false;
    for (let attempt = 0; attempt < reviewLoops; attempt += 1) {
      run.status = "executing";
      const execution = await runCodingAgent(`Original task:\n${normalized}\n\nAlex plan:\n${run.plan}\n\nBen implementation instructions:\n${run.implementation}\n\nExecute the task in the authorized coding workspace. Make real changes, run relevant checks, and return a structured result containing what changed, checks performed, and remaining warnings. Never modify files outside the authorized workspace.`);
      run.execution = execution.output;
      run.messages.push(message("ben", "ryan", run.execution));
      run.status = "reviewing";
      run.review = await generateForAgent("ryan", `Original task:\n${normalized}\n\nPlan:\n${run.plan}\n\nBen instructions:\n${run.implementation}\n\nActual executor result:\n${run.execution}`, "You are Ryan, BobAI's security and correctness reviewer. Review the actual executor result, not hypothetical code. Check authorization, workspace boundaries, command safety, secrets, validation, tests, regressions, and whether the requested change was actually performed. If sound, begin with APPROVED. Otherwise list exact corrective actions.");
      run.messages.push(message("ryan", "bob", run.review));
      approved = /^\s*approved\b/i.test(run.review);
      if (approved) break;
      if (attempt + 1 < reviewLoops) {
        run.status = "coding";
        run.implementation = await generateForAgent("ben", `Revise the implementation instructions using Ryan's review.\n\nTask:\n${normalized}\n\nCurrent instructions:\n${run.implementation}\n\nActual execution result:\n${run.execution}\n\nRyan review:\n${run.review}`, "You are Ben. Produce corrected implementation instructions only. Do not claim changes were made.");
        run.messages.push(message("ben", "ryan", run.implementation));
      }
    }
    if (!run.execution) throw new Error("coding executor produced no result");
    if (!approved) { run.status = "failed"; run.error = "Ryan did not approve the coding run after the configured review loops"; run.completedAt = new Date().toISOString(); throw Object.assign(new Error(run.error), { run }); }
    run.status = "completed"; run.completedAt = new Date().toISOString(); return run;
  } catch (error) { if (run.status !== "failed") { run.status = "failed"; run.error = error instanceof Error ? error.message : String(error); run.completedAt = new Date().toISOString(); } throw Object.assign(new Error(run.error || "coding orchestration failed"), { run }); }
}
