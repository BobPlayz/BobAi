import { DEFAULT_MODEL_ID, FALLBACK_MODEL_ID, MODEL_REGISTRY, getModelDefinition, type ModelCapability, type ModelDefinition } from "./modelRegistry.js";
import { bobModelProvider } from "./modelProvider.js";

export type ModelSelectionRequest = { modelId?: string; capability?: ModelCapability; fallbackModelId?: string };
export type SelectedModel = ModelDefinition & { configured: boolean };

function uniqueModels(models: ModelDefinition[]) {
  return models.filter((model, index) => models.findIndex((candidate) => candidate.id === model.id) === index);
}

function isConfigured(definition: ModelDefinition) {
  return bobModelProvider.isConfigured(definition.provider);
}

function candidates(request: ModelSelectionRequest): ModelDefinition[] {
  const capability = request.capability;
  const compatible = capability ? MODEL_REGISTRY.filter((model) => model.capabilities.includes(capability)) : [...MODEL_REGISTRY];
  const requested = request.modelId ? getModelDefinition(request.modelId) : undefined;
  if (request.modelId && !requested) throw new Error(`unknown model: ${request.modelId}`);
  const fallback = getModelDefinition(request.fallbackModelId || (capability === "chat" ? FALLBACK_MODEL_ID : ""));
  return uniqueModels([...(requested ? [requested] : []), ...compatible.filter((model) => model.id === DEFAULT_MODEL_ID || model.id === FALLBACK_MODEL_ID), ...compatible, ...(fallback ? [fallback] : [])]);
}

export function modelIsConfigured(definition: ModelDefinition) {
  return isConfigured(definition);
}

export async function selectModel(request: ModelSelectionRequest = {}): Promise<SelectedModel> {
  const options = candidates(request);
  if (!options.length) throw new Error("no registered model matches the requested capability");
  const selected = options.find(isConfigured);
  if (!selected) throw new Error("no BobAI model is configured for this capability");
  return { ...selected, configured: true };
}

export async function selectModelByCapability(capability: ModelCapability, fallbackModelId?: string) {
  return selectModel({ capability, fallbackModelId });
}
