import { bobNativeModel, type NativeMessage } from "./nativeModel.js";

export type ProviderMessage = NativeMessage;
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
const MAX_RESPONSE_CHARS = 200_000;
const DEFAULT_MODEL = "bob-0.2-native";
function selectedModel(provider: "bob" | "coding", modelOverride?: string) { const env = provider === "bob" ? process.env.BOBAI_MODEL_NAME : process.env.BOBAI_CODING_MODEL_NAME; const model = (modelOverride || env || DEFAULT_MODEL).trim(); if (model !== DEFAULT_MODEL) throw new Error(`unsupported native model: ${model}`); return model; }
export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> { const model = selectedModel(provider, modelOverride); const content = await bobNativeModel.generate(messages, { maxTokens: 768 }); if (!content || content.length > MAX_RESPONSE_CHARS) throw new Error("BobAI native model returned an invalid response"); return { content, model, provider }; }
  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> { const model = selectedModel(provider, modelOverride); const content = await bobNativeModel.generate(messages, { maxTokens: 768, onToken }); if (!content || content.length > MAX_RESPONSE_CHARS) throw new Error("BobAI native model returned an invalid response"); return { content, model, provider }; }
  async status() { return bobNativeModel.status(); }
  isConfigured(_provider?: "bob" | "coding") { return bobNativeModel.isAvailable(); }
}
export const bobModelProvider = new BobModelProvider();
