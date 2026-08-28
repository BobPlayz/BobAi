import { DEFAULT_MODEL_ID, FALLBACK_MODEL_ID, MODEL_REGISTRY, getModelDefinition, type ModelCapability, type ModelDefinition } from "./modelRegistry.js";
import { ollamaProvider } from "./ollamaProvider.js";

export type ModelSelectionRequest = {
  modelId?: string;
  capability?: ModelCapability;
  fallbackModelId?: string;
};

export type SelectedModel = ModelDefinition & { installed: boolean };

function uniqueModels(models: ModelDefinition[]) {
  return models.filter((model, index) => models.findIndex((candidate) => candidate.id === model.id) === index);
}

function candidates(request: ModelSelectionRequest): ModelDefinition[] {
  const capability = request.capability;
  const compatible = capability
    ? MODEL_REGISTRY.filter((model) => model.capabilities.includes(capability))
    : [...MODEL_REGISTRY];

  const requested = request.modelId ? getModelDefinition(request.modelId) : undefined;
  if (request.modelId && !requested) throw new Error(`unknown model: ${request.modelId}`);

  const fallback = getModelDefinition(request.fallbackModelId || (capability === "chat" ? FALLBACK_MODEL_ID : ""));
  const defaults = compatible.filter((model) => model.id === DEFAULT_MODEL_ID || model.id === FALLBACK_MODEL_ID);

  return uniqueModels([
    ...(requested ? [requested] : []),
    ...defaults,
    ...compatible,
    ...(fallback ? [fallback] : []),
  ]);
}

export async function selectModel(request: ModelSelectionRequest = {}): Promise<SelectedModel> {
  const options = candidates(request);
  if (!options.length) throw new Error("no registered model matches the requested capability");

  for (const definition of options) {
    const selected = await ollamaProvider.select(definition.id);
    if (selected.installed) return selected;
  }

  const names = options.map((model) => model.model).join(", ");
  throw new Error(`no requested model is installed: ${names}`);
}

export async function selectModelByCapability(capability: ModelCapability, fallbackModelId?: string) {
  return selectModel({ capability, fallbackModelId });
}
