import { randomUUID } from "node:crypto";
import { AGENT_REGISTRY } from "./modelRegistry.js";
import { ollamaProvider } from "./ollamaProvider.js";

export type OrchestrationStatus = "queued" | "planning" | "coding" | "reviewing" | "completed" | "failed";
export type AgentMessage = { id: string; from: "alex" | "ben" | "ryan"; to: "ben" | "ryan" | "bob"; content: string; createdAt: string };
export type CodingOrchestration = {
  id: string;
  task: string;
  status: OrchestrationStatus;
  messages: AgentMessage[];
  plan?: string;
  implementation?: string;
  review?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

const runs = new Map<string, CodingOrchestration>();

function message(from: AgentMessage["from"], to: AgentMessage["to"], content: string): AgentMessage {
  return { id: randomUUID(), from, to, content, createdAt: new Date().toISOString() };
}

export function getCodingOrchestration(id: string) { return runs.get(id); }
export function listCodingOrchestrations() { return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function runCodingOrchestration(task: string, maxReviewLoops = 2): Promise<CodingOrchestration> {
  const normalized = task.trim();
  if (!normalized) throw new Error("coding orchestration task is empty");
  if (normalized.length > 20_000) throw new Error("coding orchestration task cannot exceed 20000 characters");

  const run: CodingOrchestration = { id: randomUUID(), task: normalized, status: "queued", messages: [], createdAt: new Date().toISOString() };
  runs.set(run.id, run);

  try {
    run.status = "planning";
    const alex = AGENT_REGISTRY.alex;
    run.plan = await ollamaProvider.generate(alex.modelId, normalized, "You are Alex, BobAI's planner. Break the task into concrete implementation steps. Do not claim files were changed. Return a concise plan.");
    run.messages.push(message("alex", "ben", run.plan));

    run.status = "coding";
    const ben = AGENT_REGISTRY.ben;
    run.implementation = await ollamaProvider.generate(ben.modelId, `Task:\n${normalized}\n\nAlex's plan:\n${run.plan}`, "You are Ben, BobAI's coding specialist. Produce the implementation needed for the plan. You are not connected to the user's filesystem in this service, so return proposed code/changes only and never claim you edited real files.");
    run.messages.push(message("ben", "ryan", run.implementation));

    const ryan = AGENT_REGISTRY.ryan;
    for (let attempt = 0; attempt < Math.max(1, maxReviewLoops); attempt += 1) {
      run.status = "reviewing";
      run.review = await ollamaProvider.generate(ryan.modelId, `Original task:\n${normalized}\n\nPlan:\n${run.plan}\n\nProposed implementation:\n${run.implementation}`, "You are Ryan, BobAI's reviewer. Find correctness, security, typing, and regression issues. If changes are needed, list exact fixes. If it is sound, begin your response with APPROVED.");
      run.messages.push(message("ryan", "bob", run.review));
      if (/^\s*approved\b/i.test(run.review)) break;
      if (attempt + 1 < Math.max(1, maxReviewLoops)) {
        run.status = "coding";
        run.implementation = await ollamaProvider.generate(ben.modelId, `Revise this proposed implementation based on Ryan's review.\n\nTask:\n${normalized}\n\nCurrent implementation:\n${run.implementation}\n\nReview:\n${run.review}`, "You are Ben. Apply the review corrections to the proposed implementation. Return the revised proposed changes only.");
        run.messages.push(message("ben", "ryan", run.implementation));
      }
    }

    run.status = "completed";
    run.completedAt = new Date().toISOString();
    return run;
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    run.completedAt = new Date().toISOString();
    throw Object.assign(new Error(run.error), { run });
  }
}
