export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelProvider = "bob" | "coding";
export type ModelDefinition = {
  id: string;
  provider: ModelProvider;
  model: string;
  capabilities: ModelCapability[];
  description: string;
  visionReady: boolean;
};

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "bob", provider: "bob", model: process.env.BOBAI_MODEL_NAME || "", capabilities: ["chat", "reasoning", "fast"], description: "BobAI's primary assistant model", visionReady: false },
  { id: "coder", provider: "coding", model: process.env.BOBAI_CODING_MODEL_NAME || "", capabilities: ["coding", "reasoning"], description: "BobAI's primary coding model", visionReady: false },
  { id: "coder-fast", provider: "coding", model: process.env.BOBAI_CODING_FAST_MODEL_NAME || "", capabilities: ["coding", "fast"], description: "BobAI's fast coding model", visionReady: false },
];

export type BobAgentId = "bob" | "alex" | "ben" | "ryan" | "violet";
export const AGENT_REGISTRY: Record<BobAgentId, { id: BobAgentId; name: string; role: string; modelId?: string; model?: string; manager?: boolean }> = {
  bob: { id: "bob", name: "Bob", role: "manager", modelId: "bob" },
  alex: { id: "alex", name: "Alex", role: "planner", modelId: "coder-fast", model: process.env.BOBAI_CODING_FAST_MODEL_NAME },
  ben: { id: "ben", name: "Ben", role: "coder", modelId: "coder", model: process.env.BOBAI_CODING_MODEL_NAME },
  ryan: { id: "ryan", name: "Ryan", role: "reviewer", modelId: "coder-fast", model: process.env.BOBAI_CODING_FAST_MODEL_NAME },
  violet: { id: "violet", name: "Violet", role: "visual coding specialist", modelId: "coder", model: process.env.BOBAI_CODING_MODEL_NAME },
};

export const DEFAULT_MODEL_ID = "bob";
export const FALLBACK_MODEL_ID = "coder";
export const VISION_ARCHITECTURE = {
  provider: "coding",
  configuredModelEnv: "BOBAI_CODING_MODEL_NAME",
  status: "provider-managed" as const,
};

export function getModelDefinition(id: string) {
  return MODEL_REGISTRY.find((model) => model.id === id);
}

export function getAgentDefinition(id: BobAgentId) {
  return AGENT_REGISTRY[id];
}
