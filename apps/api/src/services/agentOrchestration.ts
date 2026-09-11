import { randomUUID } from "node:crypto";
import { updatePersistedAgentTask } from "../store/agentTaskDb.js";

export type AgentStep = { id: string; description: string; dependsOn?: string[]; estimatedTokens?: number; estimatedMs?: number; status?: "pending" | "running" | "completed" | "failed" | "cancelled" | "waiting"; checkpoint?: boolean };
export type AgentBudget = { maxSteps: number; maxTokens: number; maxDurationMs: number };
export type AgentPlan = { id: string; steps: AgentStep[]; budget: AgentBudget };
export type AgentCheckpoint = { id: string; stepId: string; reason: string; createdAt: string; status: "pending" | "approved" | "rejected" };

const DEFAULT_BUDGET: AgentBudget = { maxSteps: 20, maxTokens: 100_000, maxDurationMs: 30 * 60_000 };
const MAX_BUDGET: AgentBudget = { maxSteps: 50, maxTokens: 500_000, maxDurationMs: 2 * 60 * 60_000 };

export function normalizeBudget(input?: Partial<AgentBudget>): AgentBudget {
  return {
    maxSteps: Math.min(Math.max(Math.floor(input?.maxSteps ?? DEFAULT_BUDGET.maxSteps), 1), MAX_BUDGET.maxSteps),
    maxTokens: Math.min(Math.max(Math.floor(input?.maxTokens ?? DEFAULT_BUDGET.maxTokens), 1_000), MAX_BUDGET.maxTokens),
    maxDurationMs: Math.min(Math.max(Math.floor(input?.maxDurationMs ?? DEFAULT_BUDGET.maxDurationMs), 10_000), MAX_BUDGET.maxDurationMs),
  };
}

export function validateAgentPlan(steps: AgentStep[], budget?: Partial<AgentBudget>) {
  const normalized = normalizeBudget(budget);
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > normalized.maxSteps) throw new Error("agent plan exceeds the step budget");
  const ids = new Set<string>();
  for (const step of steps) {
    if (!step || typeof step.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(step.id) || ids.has(step.id)) throw new Error("agent plan contains an invalid or duplicate step id");
    ids.add(step.id);
    if (typeof step.description !== "string" || step.description.trim().length === 0 || step.description.length > 4_000) throw new Error("agent plan contains an invalid step");
    if (step.dependsOn?.some((id) => id === step.id || !/^[A-Za-z0-9_-]{1,80}$/.test(id))) throw new Error("agent plan contains an invalid dependency");
  }
  for (const step of steps) for (const dep of step.dependsOn || []) if (!ids.has(dep)) throw new Error("agent plan references a missing dependency");
  const state = new Map<string, 0 | 1 | 2>();
  const byId = new Map(steps.map((step) => [step.id, step]));
  const visit = (id: string) => { const s = state.get(id) || 0; if (s === 1) throw new Error("agent plan contains a dependency cycle"); if (s === 2) return; state.set(id, 1); for (const dep of byId.get(id)?.dependsOn || []) visit(dep); state.set(id, 2); };
  for (const step of steps) visit(step.id);
  const estimatedTokens = steps.reduce((sum, step) => sum + Math.max(0, Math.floor(step.estimatedTokens || 0)), 0);
  if (estimatedTokens > normalized.maxTokens) throw new Error("agent plan exceeds the token budget");
  return { steps, budget: normalized };
}

export function nextReadySteps(plan: AgentPlan, completed: Set<string>) { return plan.steps.filter((step) => (step.status || "pending") === "pending" && (step.dependsOn || []).every((id) => completed.has(id))); }
export function createCheckpoint(stepId: string, reason: string): AgentCheckpoint { return { id: randomUUID(), stepId, reason: reason.slice(0, 2_000), createdAt: new Date().toISOString(), status: "pending" }; }
export function requireCheckpoint(checkpoint: AgentCheckpoint) { if (checkpoint.status !== "approved") throw new Error("agent checkpoint approval is required"); }

export class AgentRunController {
  readonly startedAt = Date.now();
  private cancelled = false;
  private spentTokens = 0;
  constructor(public readonly plan: AgentPlan, private readonly taskId?: string) {}
  cancel() { this.cancelled = true; }
  isCancelled() { return this.cancelled; }
  accountTokens(tokens: number) { this.spentTokens += Math.max(0, Math.floor(tokens)); if (this.spentTokens > this.plan.budget.maxTokens) throw new Error("agent token budget exceeded"); this.check(); }
  check() { if (this.cancelled) throw new Error("agent run cancelled"); if (Date.now() - this.startedAt > this.plan.budget.maxDurationMs) throw new Error("agent run exceeded its duration budget"); }
  async persist(state: Record<string, unknown>) { if (this.taskId) await updatePersistedAgentTask({ id: this.taskId, status: "running", metadata: { orchestration: { ...state, spentTokens: this.spentTokens, startedAt: new Date(this.startedAt).toISOString() } } }).catch(() => false); }
}
