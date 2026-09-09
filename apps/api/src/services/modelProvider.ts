export type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  content: string;
  model: string;
  provider: "bob" | "coding";
};

type ProviderConfig = {
  provider: "bob" | "coding";
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;

function config(provider: "bob" | "coding"): ProviderConfig {
  const prefix = provider === "bob" ? "BOBAI_MODEL" : "BOBAI_CODING_MODEL";
  const baseUrl = (process.env[`${prefix}_URL`] || "").trim().replace(/\/$/, "");
  const apiKey = (process.env[`${prefix}_KEY`] || "").trim();
  const model = (process.env[`${prefix}_NAME`] || "").trim();
  const timeout = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000);
  if (!baseUrl || !model) throw new Error(`${provider} model is not configured`);
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error(`${provider} model URL is invalid`); }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) throw new Error(`${provider} model URL must use HTTPS outside local development`);
  return { provider, baseUrl, apiKey, model, timeoutMs: Number.isFinite(timeout) ? Math.min(Math.max(timeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS) : 120_000 };
}

export class BobModelProvider {
  async chat(messages: ProviderMessage[], provider: "bob" | "coding" = "bob"): Promise<ProviderResult> {
    const cfg = config(provider);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify({ model: cfg.model, messages, stream: false }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${provider} model returned ${response.status}`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error(`${provider} model returned an invalid response`);
      return { content, model: typeof data.model === "string" ? data.model : cfg.model, provider };
    } finally {
      clearTimeout(timer);
    }
  }

  isConfigured(provider: "bob" | "coding" = "bob") {
    try { config(provider); return true; } catch { return false; }
  }
}

export const bobModelProvider = new BobModelProvider();
