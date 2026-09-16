import { bobNativeModel, type NativeMessage } from "./nativeModel.js";
import { modelRuntime } from "./modelRuntime.js";
import { productionModelConfigured, productionModelInfer, productionModelStatus } from "./productionModelRuntime.js";

export type ProviderMessage = NativeMessage;
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
const MAX_RESPONSE_CHARS = 200_000;
const TINY_MODEL = "bob-0.2-native";
const PRODUCTION_MODEL = "bob-production";

function selectedModel(provider: "bob" | "coding", modelOverride?: string) {
  const env = provider === "bob" ? process.env.BOBAI_MODEL_NAME : process.env.BOBAI_CODING_MODEL_NAME;
  const model = (modelOverride || env || (productionModelConfigured() ? PRODUCTION_MODEL : TINY_MODEL)).trim();
  if (![TINY_MODEL, PRODUCTION_MODEL].includes(model)) throw new Error(`unsupported native model: ${model}`);
  return model;
}

export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const model = selectedModel(provider, modelOverride); const release = await modelRuntime.acquire(provider === "coding" ? "coder" : "bob");
    try {
      const result = model === PRODUCTION_MODEL ? await productionModelInfer(messages, { maxTokens: 768 }) : { content: await bobNativeModel.generate(messages, { maxTokens: 768 }), model: TINY_MODEL };
      const content = result.content;
      if (!content || content.length > MAX_RESPONSE_CHARS) throw new Error("BobAI model returned an invalid response");
      return { content, model: result.model || model, provider };
    } finally { release(); }
  }
  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const model = selectedModel(provider, modelOverride); const release = await modelRuntime.acquire(provider === "coding" ? "coder" : "bob");
    try {
      if (model === PRODUCTION_MODEL) {
        const result = await productionModelInfer(messages, { maxTokens: 768 });
        for (const token of result.content.match(/\s+|\S+/g) || [result.content]) onToken(token);
        return { content: result.content, model: result.model || model, provider };
      }
      const content = await bobNativeModel.generate(messages, { maxTokens: 768, onToken });
      if (!content || content.length > MAX_RESPONSE_CHARS) throw new Error("BobAI native model returned an invalid response");
      return { content, model, provider };
    } finally { release(); }
  }
  async status() {
    const requested = (process.env.BOBAI_MODEL_NAME || "").trim();
    if (requested === PRODUCTION_MODEL || (!requested && productionModelConfigured())) return productionModelStatus();
    return bobNativeModel.status();
  }
  isConfigured(_provider?: "bob" | "coding") {
    const requested = (process.env.BOBAI_MODEL_NAME || "").trim();
    if (requested === PRODUCTION_MODEL) return productionModelConfigured();
    if (requested === TINY_MODEL) return bobNativeModel.isAvailable();
    return productionModelConfigured() || bobNativeModel.isAvailable();
  }
}
export const bobModelProvider = new BobModelProvider();
