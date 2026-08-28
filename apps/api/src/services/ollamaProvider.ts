import { MODEL_REGISTRY, getModelDefinition, type ModelDefinition } from "./modelRegistry.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export type OllamaInstalledModel = {
  name: string;
  model?: string;
  size?: number;
  modified_at?: string;
};

export type OllamaHealth = {
  connected: boolean;
  baseUrl: string;
  error?: string;
};

export class OllamaProvider {
  readonly baseUrl: string;

  constructor(baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async health(): Promise<OllamaHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error(`ollama returned ${response.status}`);
      return { connected: true, baseUrl: this.baseUrl };
    } catch (error) {
      return { connected: false, baseUrl: this.baseUrl, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async installedModels(): Promise<OllamaInstalledModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) throw new Error(`ollama model discovery failed with ${response.status}`);
    const data = (await response.json()) as { models?: OllamaInstalledModel[] };
    return data.models || [];
  }

  async isAvailable(model: string): Promise<boolean> {
    const installed = await this.installedModels();
    return installed.some((item) => item.name === model || item.model === model);
  }

  async select(modelId: string): Promise<ModelDefinition & { installed: boolean }> {
    const definition = getModelDefinition(modelId);
    if (!definition) throw new Error(`unknown model: ${modelId}`);
    return { ...definition, installed: await this.isAvailable(definition.model) };
  }

  async generate(modelId: string, prompt: string, system?: string) {
    const selected = await this.select(modelId);
    if (!selected.installed) throw new Error(`model is not installed: ${selected.model}`);
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: selected.model, prompt, ...(system ? { system } : {}), stream: false }),
    });
    if (!response.ok) throw new Error(`ollama generation failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const data = (await response.json()) as { response?: string };
    return data.response || "";
  }

  async registryStatus() {
    const health = await this.health();
    if (!health.connected) return { ...health, models: MODEL_REGISTRY.map((model) => ({ ...model, installed: false })) };
    const installed = await this.installedModels();
    const names = new Set(installed.flatMap((item) => [item.name, item.model]).filter(Boolean));
    return {
      ...health,
      models: MODEL_REGISTRY.map((model) => ({ ...model, installed: names.has(model.model) })),
    };
  }
}

export const ollamaProvider = new OllamaProvider();
