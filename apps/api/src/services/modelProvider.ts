import type { NativeMessage } from "./nativeModel.js";
import { ollamaChat, ollamaStatus, ollamaStream } from "./ollamaProvider.js";
import { openRouterChat, openRouterStatus, openRouterStream } from "./openRouterProvider.js";

export type ProviderMessage = NativeMessage;
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
const MAX_RESPONSE_CHARS = 200_000;
const useOpenRouter = () => (process.env.BOBAI_MODEL_PROVIDER || "ollama").trim().toLowerCase() === "openrouter";

export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal): Promise<ProviderResult> {
    const result = useOpenRouter()
      ? await openRouterChat(messages, provider, signal)
      : await ollamaChat(messages, provider, modelOverride, signal);
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider };
  }

  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal): Promise<ProviderResult> {
    const result = useOpenRouter()
      ? await openRouterStream(messages, onToken, provider, signal)
      : await ollamaStream(messages, onToken, provider, modelOverride, signal);
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider };
  }

  async status() {
    return useOpenRouter() ? openRouterStatus() : ollamaStatus();
  }

  isConfigured(_provider?: "bob" | "coding") {
    return useOpenRouter() ? Boolean(process.env.OPENROUTER_API_KEY?.trim()) : true;
  }
}

export const bobModelProvider = new BobModelProvider();
