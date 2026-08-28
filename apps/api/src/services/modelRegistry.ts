export type ModelCapability = "chat" | "reasoning" | "coding" | "fast" | "vision";
export type ModelDefinition = { id: string; provider: "ollama"; model: string; capabilities: ModelCapability[]; description: string; visionReady: boolean };

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "qwen-3b", provider: "ollama", model: "qwen2.5:3b", capabilities: ["chat", "reasoning", "fast"], description: "fast general-purpose local chat and reasoning", visionReady: false },
  { id: "qwen-7b", provider: "ollama", model: "qwen2.5:7b", capabilities: ["chat", "reasoning"], description: "stronger local reasoning and general chat", visionReady: false },
  { id: "coder-1.5b", provider: "ollama", model: "qwen2.5-coder:1.5b", capabilities: ["coding", "fast"], description: "lightweight local coding model", visionReady: false },
  { id: "coder-latest", provider: "ollama", model: "qwen2.5-coder:latest", capabilities: ["coding", "reasoning"], description: "strong local coding model", visionReady: false },
];

export type BobAgentId = "alex" | "ben" | "ryan";
export const AGENT_REGISTRY: Record<BobAgentId, { id: BobAgentId; name: string; role: string; modelId: string; model: string }> = {
  alex: { id: "alex", name: "Alex", role: "planner", modelId: "qwen-3b", model: process.env.OLLAMA_ALEX_MODEL || "qwen2.5:3b" },
  ben: { id: "ben", name: "Ben", role: "coder", modelId: "coder-latest", model: process.env.OLLAMA_BEN_MODEL || "qwen2.5-coder:latest" },
  ryan: { id: "ryan", name: "Ryan", role: "reviewer", modelId: "qwen-3b", model: process.env.OLLAMA_RYAN_MODEL || "qwen2.5:3b" },
};

export const VISION_ARCHITECTURE = { provider: "ollama", configuredModelEnv: "BOBAI_VISION_MODEL", installedModelRequired: true, status: "prepared-not-installed" as const };
export function getModelDefinition(id: string) { return MODEL_REGISTRY.find((model) => model.id === id); }
export function getAgentDefinition(id: BobAgentId) { return AGENT_REGISTRY[id]; }
