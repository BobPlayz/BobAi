import { MODEL_REGISTRY, type ModelCapability, type ModelDefinition } from "./modelRegistry.js";
import { ollamaProvider } from "./ollamaProvider.js";

export type ModelSelectionRequest = {
  modelId?: string;
  capability?: ModelCapability;
  fallbackModelId?: string;
};

export type SelectedModel = ModelDefinition & { installed: boolean };

function candidates(request: ModelSelectionRequest): ModelDefinition[] {
  const requested = request.modelId ? MODEL_REGISTRY.find((model) => model.id === request.modelId) : undefined;
  if (requested) return [requested, ...MODEL_REGISTRY.filter((model) => model.id !== requested.id)];

  const capability = request.capability;
  const fallback = request.fallbackModelId ? MODEL_REGISTRY.find((model) => model.id === request.fallbackModelId) : undefined;
  const compatible = capability ? MODEL_REGISTRY.filter((model) => model.capabilities.includes(capability)) : [...MODEL_REGISTRY];
  return fallback && !compatible.some((model) => model.id === fallback.id) ? [...compatible, fallback] : compatible;
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
