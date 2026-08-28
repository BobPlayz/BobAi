import { MODEL_REGISTRY, getModelDefinition, type ModelDefinition } from "./modelRegistry.js";
import { recordProviderFailure, recordProviderSuccess } from "./providerHealth.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 120_000;
const PROVIDER_ID = "ollama";

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
  readonly timeoutMs: number;

  constructor(baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL, timeoutMs = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  }

  private async request(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<OllamaHealth> {
    try {
      const response = await this.request(`${this.baseUrl}/api/tags`, { method: "GET" });
      if (!response.ok) throw new Error(`ollama returned ${response.status}`);
      recordProviderSuccess(PROVIDER_ID);
      return { connected: true, baseUrl: this.baseUrl };
    } catch (error) {
      recordProviderFailure(PROVIDER_ID);
      return { connected: false, baseUrl: this.baseUrl, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async installedModels(): Promise<OllamaInstalledModel[]> {
    try {
      const response = await this.request(`${this.baseUrl}/api/tags`, { method: "GET" });
      if (!response.ok) throw new Error(`ollama model discovery failed with ${response.status}`);
      const data = (await response.json()) as { models?: OllamaInstalledModel[] };
      recordProviderSuccess(PROVIDER_ID);
      return data.models || [];
    } catch (error) {
      recordProviderFailure(PROVIDER_ID);
      throw error;
    }
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
    try {
      const response = await this.request(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: selected.model, prompt, ...(system ? { system } : {}), stream: false }),
      });
      if (!response.ok) throw new Error(`ollama generation failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
      const data = (await response.json()) as { response?: string };
      recordProviderSuccess(PROVIDER_ID);
      return data.response || "";
    } catch (error) {
      recordProviderFailure(PROVIDER_ID);
      throw error;
    }
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
