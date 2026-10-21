import type { NativeMessage } from "./nativeModel.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_CHARS = 200_000;

export function openRouterModelFor(provider: "bob" | "coding" = "bob") {
  const value = (provider === "coding"
    ? process.env.BOBAI_OPENROUTER_CODING_MODEL || process.env.BOBAI_OPENROUTER_MODEL || "openrouter/free"
    : process.env.BOBAI_OPENROUTER_MODEL || "openrouter/free").trim();
  if (!value || value.length > 160 || /[\r\n]/.test(value) || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value)) {
    throw new Error("Invalid OpenRouter model name");
  }
  return value;
}

function normalizedMessages(input: NativeMessage[]) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error("OpenRouter requires 1-100 messages");
  const messages = input.map((message) => {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      throw new Error("Invalid OpenRouter message");
    }
    return { role: message.role, content: message.content };
  });
  if (messages.reduce((sum, message) => sum + message.content.length, 0) > 120_000) throw new Error("OpenRouter prompt is too large");
  return messages;
}

function timeoutMs() {
  const value = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 90_000);
  return Math.min(Math.max(Number.isFinite(value) ? value : 90_000, 1_000), 180_000);
}

async function call(input: NativeMessage[], provider: "bob" | "coding", stream: boolean, signal?: AbortSignal) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OpenRouter is selected but OPENROUTER_API_KEY is not configured");
  const model = openRouterModelFor(provider);
  const body = JSON.stringify({
    model,
    messages: normalizedMessages(input),
    stream,
    max_tokens: Math.min(2048, Math.max(64, Number(process.env.BOBAI_OPENROUTER_MAX_TOKENS || 768))),
    temperature: 0.7,
  });
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw new Error("OpenRouter request is too large");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: stream ? "text/event-stream" : "application/json",
  };
  if (process.env.BOBAI_WEB_URL) headers["HTTP-Referer"] = process.env.BOBAI_WEB_URL;
  headers["X-Title"] = "Jarvis";
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body,
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs())]) : AbortSignal.timeout(timeoutMs()),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401) throw new Error("OpenRouter rejected the API key. Check OPENROUTER_API_KEY in Vercel.");
    if (response.status === 402) throw new Error("OpenRouter credits or provider allowance are insufficient.");
    if (response.status === 429) throw new Error("OpenRouter rate limit reached. Try again shortly.");
    throw new Error(`OpenRouter request failed with HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("OpenRouter returned an empty response body");
  return { response, model };
}

async function readBounded(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "", bytes = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    bytes += item.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("OpenRouter response is too large");
    }
    output += decoder.decode(item.value, { stream: true });
  }
  return output + decoder.decode();
}

export async function openRouterChat(input: NativeMessage[], provider: "bob" | "coding" = "bob", signal?: AbortSignal) {
  const { response, model } = await call(input, provider, false, signal);
  let data: any;
  try { data = JSON.parse(await readBounded(response)); } catch (error) {
    if (error instanceof Error && error.message.includes("too large")) throw error;
    throw new Error("OpenRouter returned invalid JSON");
  }
  if (data?.error) throw new Error("OpenRouter model returned an error");
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) {
    throw new Error("OpenRouter returned an invalid or empty answer");
  }
  return { content: content.trim(), model: typeof data.model === "string" ? data.model : model };
}

export async function openRouterStream(input: NativeMessage[], onToken: (token: string) => void, provider: "bob" | "coding" = "bob", signal?: AbortSignal) {
  const { response, model } = await call(input, provider, true, signal);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let pending = "", content = "", bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("OpenRouter stream is too large");
      pending += decoder.decode(item.value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let data: any;
        try { data = JSON.parse(payload); } catch { throw new Error("OpenRouter stream returned invalid data"); }
        if (data?.error) throw new Error("OpenRouter model returned a streaming error");
        const token = data?.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token) {
          content += token;
          if (content.length > MAX_RESPONSE_CHARS) throw new Error("OpenRouter response is too large");
          onToken(token);
        }
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  if (!content.trim()) throw new Error("OpenRouter returned an empty answer");
  return { content: content.trim(), model };
}

export function openRouterStatus() {
  const configured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return {
    ready: configured,
    provider: "openrouter" as const,
    model: openRouterModelFor("bob"),
    codingModel: openRouterModelFor("coding"),
    error: configured ? undefined : "OPENROUTER_API_KEY is not configured",
  };
}
