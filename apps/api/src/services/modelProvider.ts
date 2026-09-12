export type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderResult = { content: string; model: string; provider: "bob" | "coding" };
type ProviderConfig = { provider: "bob" | "coding"; baseUrl: string; apiKey: string; model: string; timeoutMs: number };
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_RESPONSE_CHARS = 200_000;
const LOCAL_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5:3b";

function config(provider: "bob" | "coding", modelOverride?: string): ProviderConfig {
  const prefix = provider === "bob" ? "BOBAI_MODEL" : "BOBAI_CODING_MODEL";
  const baseUrl = (process.env[`${prefix}_URL`] || LOCAL_OLLAMA_URL).trim().replace(/\/$/, "");
  const apiKey = (process.env[`${prefix}_KEY`] || "").trim();
  const model = (modelOverride || process.env[`${prefix}_NAME`] || DEFAULT_MODEL).trim();
  const timeout = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000);
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error(`${provider} model URL is invalid`); }
  const hostname = url.hostname.toLowerCase();
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) throw new Error(`${provider} model URL must use HTTPS unless it points to localhost`);
  return { provider, baseUrl, apiKey, model, timeoutMs: Number.isFinite(timeout) ? Math.min(Math.max(timeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS) : 120_000 };
}
function headers(cfg: ProviderConfig) { return { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) }; }
async function readJson(response: Response) {
  const contentLength = Number(response.headers.get("content-length")); if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error("model response exceeded the safety limit");
  const text = await response.text(); if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("model response exceeded the safety limit");
  try { return JSON.parse(text) as unknown; } catch { throw new Error("model provider returned invalid JSON"); }
}
export class BobModelProvider {
  private controller(timeoutMs: number) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); return { controller, timer }; }
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const cfg = config(provider, modelOverride); const { controller, timer } = this.controller(cfg.timeoutMs);
    try {
      const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, { method: "POST", headers: headers(cfg), body: JSON.stringify({ model: cfg.model, messages, stream: false }), signal: controller.signal, redirect: "error" });
      if (!response.ok) throw new Error(`${provider} model returned ${response.status}`);
      const data = await readJson(response) as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) throw new Error(`${provider} model returned an invalid response`);
      return { content, model: typeof data.model === "string" ? data.model.slice(0, 200) : cfg.model, provider };
    } finally { clearTimeout(timer); }
  }
  async stream(messages: ProviderMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", modelOverride?: string): Promise<ProviderResult> {
    const cfg = config(provider, modelOverride); const { controller, timer } = this.controller(cfg.timeoutMs);
    try {
      const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, { method: "POST", headers: headers(cfg), body: JSON.stringify({ model: cfg.model, messages, stream: true }), signal: controller.signal, redirect: "error" });
      if (!response.ok || !response.body) throw new Error(`${provider} model stream failed with ${response.status}`);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let full = ""; let model = cfg.model;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); if (Buffer.byteLength(buffer, "utf8") > MAX_RESPONSE_BYTES) throw new Error("model response exceeded the safety limit");
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue; const payload = trimmed.slice(5).trim(); if (payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: unknown } }>; model?: unknown };
            if (typeof data.model === "string" && data.model.length <= 200) model = data.model;
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
