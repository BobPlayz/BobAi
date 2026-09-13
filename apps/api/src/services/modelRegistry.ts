export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelProvider = "bob" | "coding";
export type ModelDefinition = { id: string; name: string; provider: ModelProvider; model: string; capabilities: ModelCapability[]; description: string; visionReady: boolean };

const NATIVE_MODEL = "bob-0.2-native";

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "bob", name: "BobAI", provider: "bob", model: NATIVE_MODEL, capabilities: ["chat", "reasoning", "coding", "fast", "vision"], description: "BobAI's unified native model. It decides when to answer directly and when to request available tools.", visionReady: false },
];

export type BobAgentId = "worker";
export const AGENT_REGISTRY: Record<BobAgentId, { id: BobAgentId; name: string; role: string; modelId?: string; model?: string; manager?: boolean }> = {
  worker: { id: "worker", name: "worker", role: "execution worker", modelId: "bob", model: NATIVE_MODEL },
};

export const DEFAULT_MODEL_ID = "bob";
export const FALLBACK_MODEL_ID = "bob";
export const VISION_ARCHITECTURE = { provider: "bob", configuredModel: NATIVE_MODEL, status: "native-runtime" as const };
export function getModelDefinition(id: string) { return MODEL_REGISTRY.find((model) => model.id === id); }
export function getAgentDefinition(id: BobAgentId) { return AGENT_REGISTRY[id]; }
