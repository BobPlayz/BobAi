import type { NativeMessage } from "./nativeModel.js";

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_CHARS = 200_000;

export const OPENAI_MODEL_ID = "openai-chat";

function timeoutMs() {
  const value = Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS || 120_000);
  return Math.min(Math.max(Number.isFinite(value) ? value : 120_000, 1_000), 180_000);
}

export function openAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openAIBaseUrl(raw = process.env.BOBAI_OPENAI_BASE_URL || "https://api.openai.com/v1") {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid OpenAI-compatible provider URL"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Provider URL must be HTTP(S), without credentials, query, or fragment");
  }
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase())) {
    throw new Error("Remote AI providers must use HTTPS");
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizeMessages(input: NativeMessage[]) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error("Provider requires 1-100 messages");
  const messages = input.map((message) => {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      throw new Error("Invalid provider message");
    }
    return { role: message.role, content: message.content };
  });
  if (messages.reduce((sum, message) => sum + message.content.length, 0) > 120_000) throw new Error("Provider prompt is too large");
  return messages;
}

function requestModel() {
  const model = (process.env.BOBAI_OPENAI_MODEL || "gpt-4o-mini").trim();
  if (!model || model.length > 160 || /[\r\n]/.test(model)) throw new Error("Invalid configured provider model");
  return model;
}

async function request(messages: ReturnType<typeof normalizeMessages>, stream: boolean) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Hosted AI is not configured. Set OPENAI_API_KEY on the API server.");
  const body = JSON.stringify({ model: requestModel(), messages, stream, max_tokens: 768 });
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw new Error("Provider request is too large");
  const response = await fetch(`${openAIBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs()),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401) throw new Error("Hosted AI authentication failed. Check OPENAI_API_KEY.");
    if (response.status === 429) throw new Error("Hosted AI rate limit or quota reached.");
    throw new Error(`Hosted AI request failed with HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("Hosted AI returned an empty response body");
  return response;
}

async function readLimited(response: Response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error("Hosted AI response is too large");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let total = 0, output = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Hosted AI response is too large");
    }
    output += decoder.decode(chunk.value, { stream: true });
  }
  return output + decoder.decode();
}

export async function openAIChat(input: NativeMessage[]) {
  const response = await request(normalizeMessages(input), false);
  let data: { choices?: Array<{ message?: { content?: unknown } }> };
  try { data = JSON.parse(await readLimited(response)); } catch (error) {
    if (error instanceof Error && error.message.includes("too large")) throw error;
    throw new Error("Hosted AI returned invalid JSON");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) {
    throw new Error("Hosted AI returned an invalid or empty answer");
  }
  return { content: content.trim(), model: requestModel() };
}

export async function openAIStream(input: NativeMessage[], onToken: (token: string) => void) {
  const response = await request(normalizeMessages(input), true);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let pending = "", content = "", total = 0, done = false;
  const parseLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const value = line.slice(5).trim();
    if (!value) return;
    if (value === "[DONE]") { done = true; return; }
    let data: { choices?: Array<{ delta?: { content?: unknown } }> };
    try { data = JSON.parse(value); } catch { throw new Error("Hosted AI stream returned invalid data"); }
    const token = data.choices?.[0]?.delta?.content;
    if (typeof token === "string" && token) {
      content += token;
      if (content.length > MAX_RESPONSE_CHARS) throw new Error("Hosted AI response is too large");
      onToken(token);
    }
  };
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error("Hosted AI stream is too large");
      pending += decoder.decode(chunk.value, { stream: true });
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        parseLine(pending.slice(0, newline).replace(/\r$/, ""));
        pending = pending.slice(newline + 1);
        newline = pending.indexOf("\n");
      }
    }
    pending += decoder.decode();
    if (pending.trim()) parseLine(pending.replace(/\r$/, ""));
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  if (!content.trim()) throw new Error("Hosted AI returned an empty answer");
  return { content: content.trim(), model: requestModel() };
}

export async function openAIImageAnalysis(imageDataUrl: string, prompt: string) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Hosted image understanding is not configured.");
  if (typeof imageDataUrl !== "string" || !/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(imageDataUrl) || imageDataUrl.length > 2_800_000) throw new Error("Image must be a supported PNG, JPEG, or WebP data URL under 2 MB.");
  if (typeof prompt !== "string" || prompt.length > 8_000) throw new Error("Vision prompt is too long.");
  const body = JSON.stringify({ model: requestModel(), stream: false, max_tokens: 768, messages: [{ role: "user", content: [{ type: "text", text: prompt.trim() || "Describe this image and its relevant details." }, { type: "image_url", image_url: { url: imageDataUrl } }] }] });
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw new Error("Image request is too large.");
  const response = await fetch(`${openAIBaseUrl()}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body, redirect: "error", signal: AbortSignal.timeout(timeoutMs()) });
  if (!response.ok) { await response.body?.cancel().catch(() => undefined); if (response.status === 401) throw new Error("Hosted AI authentication failed. Check OPENAI_API_KEY."); if (response.status === 429) throw new Error("Hosted AI rate limit or quota reached."); throw new Error(`Hosted image analysis failed with HTTP ${response.status}`); }
  let data: { choices?: Array<{ message?: { content?: unknown } }> };
  try { data = JSON.parse(await readLimited(response)); } catch (error) { if (error instanceof Error && error.message.includes("too large")) throw error; throw new Error("Hosted image analysis returned invalid JSON."); }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim() || content.length > MAX_RESPONSE_CHARS) throw new Error("Hosted image analysis returned an empty or invalid description.");
  return { model: requestModel(), response: content.trim() };
}
export function openAIStatus() {
  return { ready: openAIConfigured(), provider: "openai-compatible", modelId: OPENAI_MODEL_ID, model: process.env.BOBAI_OPENAI_MODEL || "gpt-4o-mini", error: openAIConfigured() ? undefined : "OPENAI_API_KEY is not configured" };
}
