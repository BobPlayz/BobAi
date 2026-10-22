import type { NativeMessage } from "./nativeModel.js";
import { routeChat, routeStream, routingStatus, type RouteTask } from "./modelRouter.js";

export type ProviderMessage = NativeMessage;
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding"; fallbacks: number };
const MAX_RESPONSE_CHARS = 200_000;

/**
 * Jarvis uses Ollama only (local, the Jarvis gateway, or Ollama Cloud). The model for each request is chosen by the
 * router from the models the endpoint actually offers; `modelOverride` is an optional explicit choice.
 */
export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal, task?: RouteTask): Promise<ProviderResult> {
    const result = await routeChat(messages, { task: task ?? (provider === "coding" ? "coding" : undefined), preferredModel: modelOverride, signal });
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider, fallbacks: result.fallbacks };
  }

  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string, signal?: AbortSignal, task?: RouteTask): Promise<ProviderResult> {
    const result = await routeStream(messages, onToken, { task: task ?? (provider === "coding" ? "coding" : undefined), preferredModel: modelOverride, signal });
    if (!result.content || result.content.length > MAX_RESPONSE_CHARS) throw new Error("Model provider returned an invalid response");
    return { content: result.content, model: result.model, provider, fallbacks: result.fallbacks };
  }

  async status() {
    return routingStatus();
  }

  isConfigured(_provider?: "bob" | "coding") {
    return true;
  }
}

export const bobModelProvider = new BobModelProvider();
