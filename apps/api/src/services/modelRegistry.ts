import { ollamaModelFor } from "./ollamaProvider.js";

export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelProvider = "bob" | "coding";
export type ModelDefinition = { id: string; name: string; provider: ModelProvider; model: string; capabilities: ModelCapability[]; description: string; visionReady: boolean };

const CHAT_MODEL = ollamaModelFor("bob");
const CODING_MODEL = ollamaModelFor("coding");

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "bob", name: "BobAI", provider: "bob", model: CHAT_MODEL, capabilities: ["chat", "reasoning", "fast"], description: "Local Ollama model for BobAI conversations.", visionReady: false },
  { id: "bob-coder", name: "BobAI Coder", provider: "coding", model: CODING_MODEL, capabilities: ["coding"], description: "Local Ollama coding model for code generation and debugging.", visionReady: false },
];

export type BobAgentId = "worker";
export const AGENT_REGISTRY: Record<BobAgentId, { id: BobAgentId; name: string; role: string; modelId?: string; model?: string; manager?: boolean }> = {
  worker: { id: "worker", name: "worker", role: "execution worker", modelId: "bob", model: CHAT_MODEL },
};

export const DEFAULT_MODEL_ID = "bob";
export const FALLBACK_MODEL_ID = "bob";
export const VISION_ARCHITECTURE = { provider: "bob", configuredModel: CHAT_MODEL, status: "local-specialist" as const };
export function getModelDefinition(id: string) { return MODEL_REGISTRY.find((model) => model.id === id); }
export function getAgentDefinition(id: BobAgentId) { return AGENT_REGISTRY[id]; }
