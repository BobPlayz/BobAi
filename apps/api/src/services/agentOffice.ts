import { randomUUID } from "node:crypto";

export type AgentOfficeStatus = "idle" | "thinking" | "researching" | "coding" | "testing" | "creating" | "editing" | "uploading" | "waiting" | "completed" | "failed";
export type AgentOfficeAgent = { id: string; name: string; role: string; status: AgentOfficeStatus; activity: string; location: string; currentTaskId?: string; updatedAt: string };
export type AgentOfficeEvent = { type: "agent.created" | "agent.updated" | "agent.removed"; agent: AgentOfficeAgent; timestamp: string };

const agents = new Map<string, AgentOfficeAgent>();
const listeners = new Set<(event: AgentOfficeEvent) => void>();

function emit(type: AgentOfficeEvent["type"], agent: AgentOfficeAgent) {
  const event = { type, agent: { ...agent }, timestamp: new Date().toISOString() };
  for (const listener of listeners) listener(event);
}

export function createOfficeAgent(input: { id?: string; name: string; role: string }) {
  const agent: AgentOfficeAgent = { id: input.id || randomUUID(), name: input.name, role: input.role, status: "idle", activity: "waiting for work", location: "lobby", updatedAt: new Date().toISOString() };
  agents.set(agent.id, agent); emit("agent.created", agent); return agent;
}
export function listOfficeAgents() { return [...agents.values()]; }
export function getOfficeAgent(id: string) { return agents.get(id) || null; }
export function updateOfficeAgent(id: string, update: Partial<Pick<AgentOfficeAgent, "status" | "activity" | "location" | "currentTaskId">>) {
  const agent = agents.get(id); if (!agent) return null;
  Object.assign(agent, update, { updatedAt: new Date().toISOString() }); emit("agent.updated", agent); return agent;
}
export function subscribeOffice(listener: (event: AgentOfficeEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function officeAgentFromTask(task: { id: string; title: string; kind: string }) {
  const existing = [...agents.values()].find((agent) => agent.currentTaskId === task.id); if (existing) return existing;
  const agent = createOfficeAgent({ name: `${task.kind} agent`, role: task.kind });
  updateOfficeAgent(agent.id, { currentTaskId: task.id, status: task.kind === "media" ? "creating" : task.kind === "automation" ? "thinking" : "coding", activity: task.title, location: task.kind === "media" ? "media studio" : "workstation" });
  return getOfficeAgent(agent.id)!;
}
