import type { NativeMessage } from "./nativeModel.js";
import { ollamaChat, ollamaStatus, ollamaStream } from "./ollamaProvider.js";

export type ProviderMessage = NativeMessage;
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
const MAX_RESPONSE_CHARS = 200_000;

/**
 * Jarvis uses Ollama only: locally, or on your own machine through the authenticated Jarvis Ollama gateway
 * (set BOBAI_OLLAMA_BASE_URL and BOBAI_OLLAMA_API_KEY). No hosted inference provider is used.
 */
export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal): Promise<ProviderResult> {
    const result = await ollamaChat(messages, provider, modelOverride, signal);
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider };
  }

  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal): Promise<ProviderResult> {
    const result = await ollamaStream(messages, onToken, provider, modelOverride, signal);
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider };
  }

  async status() {
    return ollamaStatus();
  }

  isConfigured(_provider?: "bob" | "coding") {
    return true;
  }
}

export const bobModelProvider = new BobModelProvider();
