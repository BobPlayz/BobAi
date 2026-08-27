import { listAgentSkills, type AgentSkillId } from "./agentSkills.js";

export type Capability = { id: AgentSkillId; enabled: boolean; description: string };
export const listCapabilities = (): Capability[] => listAgentSkills().map(({ id, available, description }) => ({ id, enabled: available, description }));
export function requireCapabilities(requested: string[]) {
  const available = new Set(listCapabilities().filter((item) => item.enabled).map((item) => item.id));
  const missing = requested.filter((id) => !available.has(id as AgentSkillId));
  return { allowed: missing.length === 0, missing };
}
