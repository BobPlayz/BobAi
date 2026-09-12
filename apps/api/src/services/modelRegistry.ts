export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelProvider = "bob" | "coding";
export type ModelDefinition = { id: string; provider: ModelProvider; model: string; capabilities: ModelCapability[]; description: string; visionReady: boolean };

const NATIVE_MODEL = "bob-0.2-native";

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "bob", provider: "bob", model: NATIVE_MODEL, capabilities: ["chat", "reasoning", "fast"], description: "BobAI's native from-scratch transformer assistant", visionReady: false },
  { id: "coder", provider: "coding", model: NATIVE_MODEL, capabilities: ["coding", "reasoning", "fast"], description: "BobAI's native model for coding tasks", visionReady: false },
  { id: "coder-fast", provider: "coding", model: NATIVE_MODEL, capabilities: ["coding", "fast"], description: "BobAI's native fast coding profile", visionReady: false },
];

export type BobAgentId = "bob" | "alex" | "ben" | "ryan" | "violet";
export const AGENT_REGISTRY: Record<BobAgentId, { id: BobAgentId; name: string; role: string; modelId?: string; model?: string; manager?: boolean }> = {
  bob: { id: "bob", name: "Bob", role: "manager", modelId: "bob" },
  alex: { id: "alex", name: "Alex", role: "planner", modelId: "coder-fast", model: NATIVE_MODEL },
  ben: { id: "ben", name: "Ben", role: "coder", modelId: "coder", model: NATIVE_MODEL },
  ryan: { id: "ryan", name: "Ryan", role: "reviewer", modelId: "coder-fast", model: NATIVE_MODEL },
  violet: { id: "violet", name: "Violet", role: "visual coding specialist", modelId: "coder", model: NATIVE_MODEL },
};

export const DEFAULT_MODEL_ID = "bob";
export const FALLBACK_MODEL_ID = "coder";
export const VISION_ARCHITECTURE = { provider: "bob", configuredModel: NATIVE_MODEL, status: "native-runtime" as const };
export function getModelDefinition(id: string) { return MODEL_REGISTRY.find((model) => model.id === id); }
export function getAgentDefinition(id: BobAgentId) { return AGENT_REGISTRY[id]; }
