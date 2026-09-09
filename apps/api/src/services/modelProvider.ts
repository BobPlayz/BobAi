export type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
type ProviderConfig = { provider: "bob" | "coding"; baseUrl: string; apiKey: string; model: string; timeoutMs: number };
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_RESPONSE_CHARS = 200_000;

function config(provider: "bob" | "coding", modelOverride?: string): ProviderConfig {
  const prefix = provider === "bob" ? "BOBAI_MODEL" : "BOBAI_CODING_MODEL";
  const baseUrl = (process.env[`${prefix}_URL`] || "").trim().replace(/\/$/, "");
  const apiKey = (process.env[`${prefix}_KEY`] || "").trim();
  const model = (modelOverride || process.env[`${prefix}_NAME"] || "").trim();
  const timeout = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000);
  if (!baseUrl || !model) throw new Error(`${provider} model is not configured`);
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error(`${provider} model URL is invalid`); }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) throw new Error(`${provider} model URL must use HTTPS outside local development`);
  return { provider, baseUrl, apiKey, model, timeoutMs: Number.isFinite(timeout) ? Math.min(Math.max(timeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS) : 120_000 };
}
function headers(cfg: ProviderConfig) { return { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) }; }

export class BobModelProvider {
  private controller(timeoutMs: number) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); return { controller, timer }; }
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const cfg = config(provider, modelOverride); const { controller, timer } = this.controller(cfg.timeoutMs);
    try {
      const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, { method: "POST", headers: headers(cfg), body: JSON.stringify({ model: cfg.model, messages, stream: false }), signal: controller.signal });
      if (!response.ok) throw new Error(`${provider} model returned ${response.status}`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) throw new Error(`${provider} model returned an invalid response`);
      return { content, model: typeof data.model === "string" ? data.model : cfg.model, provider };
    } finally { clearTimeout(timer); }
  }
  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const cfg = config(provider, modelOverride); const { controller, timer } = this.controller(cfg.timeoutMs);
    try {
      const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, { method: "POST", headers: headers(cfg), body: JSON.stringify({ model: cfg.model, messages, stream: true }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`${provider} model stream failed with ${response.status}`);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let full = ""; let model = cfg.model;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue; const payload = trimmed.slice(5).trim(); if (payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: unknown } }>; model?: unknown };
            if (typeof data.model === "string") model = data.model;
            const token = data.choices?.[0]?.delta?.content; if (typeof token !== "string" || !token) continue;
            full += token; if (full.length > MAX_RESPONSE_CHARS) throw new Error("model response exceeded the safety limit"); onToken(token);
          } catch (error) { if (error instanceof Error && error.message.includes("safety limit")) throw error; }
        }
      }
      if (!full) throw new Error(`${provider} model returned an empty stream`);
      return { content: full, model, provider };
    } finally { clearTimeout(timer); }
  }
  isConfigured(provider: "bob" | "coding" = "bob") { try { config(provider); return true; } catch { return false; } }
}
export const bobModelProvider = new BobModelProvider();
