type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const MAX_TITLE_RESPONSE_BYTES = 16 * 1024;
const TITLE_TIMEOUT_MS = 10_000;

function ollamaUrl() {
  const raw = (process.env.BOBAI_OLLAMA_URL || "http://127.0.0.1:11434").trim();
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid Ollama URL");
  if (url.username || url.password || url.hash) throw new Error("invalid Ollama URL");
  return url.toString().replace(/\/$/, "");
}

export async function generateConversationTitle(messages: ChatMessage[]): Promise<string> {
  const sample = messages.slice(-8).map((m) => `${m.role}: ${m.content.slice(0, 2_000)}`).join("\n");
  const prompt = `Generate a very short conversation title. Rules: 2 to 5 words, lowercase, no quotes, no punctuation, summarize the actual topic. Conversation:\n${sample}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS);
  try {
    const response = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.BOBAI_TITLE_MODEL || "qwen2.5:3b", messages: [{ role: "user", content: prompt }], stream: false, options: { temperature: 0.2 } }),
      signal: controller.signal,
      redirect: "error",
    });
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_TITLE_RESPONSE_BYTES) throw new Error("title response too large");
    const text = await response.text();
    if (text.length > MAX_TITLE_RESPONSE_BYTES || !response.ok) throw new Error("title generation failed");
    const parsed = JSON.parse(text) as { message?: { content?: unknown } };
    const title = typeof parsed.message?.content === "string" ? parsed.message.content.trim().replace(/[\"'.!,;:]+/g, "").replace(/\s+/g, " ").toLowerCase().slice(0, 40) : "";
    return title || "new chat";
  } catch {
    return "new chat";
  } finally {
    clearTimeout(timer);
  }
}
