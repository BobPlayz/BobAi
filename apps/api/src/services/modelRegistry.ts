export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelProvider = "bob" | "coding";
export type ModelDefinition = { id: string; name: string; provider: ModelProvider; model: string; capabilities: ModelCapability[]; description: string; visionReady: boolean };

// Jarvis "modes" the client can ask for. The actual Ollama model is picked per request by the model router.
const CHAT_MODEL = "auto";
const CODING_MODEL = "auto";

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "bob", name: "BobAI", provider: "bob", model: CHAT_MODEL, capabilities: ["chat", "reasoning", "fast"], description: "Jarvis conversations; the best available Ollama model is picked per request.", visionReady: false },
  { id: "bob-coder", name: "BobAI Coder", provider: "coding", model: CODING_MODEL, capabilities: ["coding"], description: "Coding help; routed to the best available Ollama model for code.", visionReady: false },
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
