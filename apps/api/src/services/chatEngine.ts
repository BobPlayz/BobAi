import ollama from "ollama";
import { extractMemory } from "../utils/memoryExtractor.js";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatInput = {
  messages: unknown;
  personality?: unknown;
};

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_PERSONALITY_LENGTH = 10_000;

export function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input.map((message: unknown) => {
    const value = message as { role?: unknown; content?: unknown } | null;
    return {
      role: value?.role === "assistant" ? "assistant" : "user",
      content: typeof value?.content === "string" ? value.content : String(value?.content ?? ""),
    };
  });
}

export function validateChat(messages: ChatMessage[], personality: string): string | null {
  if (messages.length === 0) return "messages must contain at least one message";
  if (messages.length > MAX_MESSAGES) return `messages cannot contain more than ${MAX_MESSAGES} items`;
  if (messages.some((message) => message.content.length > MAX_MESSAGE_LENGTH)) {
    return `each message cannot exceed ${MAX_MESSAGE_LENGTH} characters`;
  }
  if (personality.length > MAX_PERSONALITY_LENGTH) {
    return `personality cannot exceed ${MAX_PERSONALITY_LENGTH} characters`;
  }
  return null;
}

export function getLatestUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return [...messages].reverse().find((message) => message.role === "user");
}

export function getPersonality(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function buildSystemPrompt(personality: string): ChatMessage {
  return {
    role: "system",
    content: `you are bobai.

default language: english unless the user explicitly changes language.

talk naturally, casually, and like a real person.
keep grammar relaxed.
avoid sounding like a textbook.
adapt to the user's writing style over time.

never randomly switch languages.
never claim to remember information that is not present in the supplied conversation or memory context.

user customization:
${personality || "none"}

saved memory is handled by the memory service and is intentionally not read from a local fallback store.`,
  };
}

export function prepareChat(input: ChatInput) {
  const messages = normalizeMessages(input.messages);
  const personality = getPersonality(input.personality);
  const latestUserMessage = getLatestUserMessage(messages);

  return {
    messages,
    personality,
    latestUserMessage,
    validationError: validateChat(messages, personality),
    memoryRequest: Boolean(latestUserMessage && extractMemory(latestUserMessage.content)),
    ollamaMessages: [buildSystemPrompt(personality), ...messages],
    title: latestUserMessage?.content?.slice(0, 32) || messages[0]?.content?.slice(0, 32) || "new chat",
  };
}

export async function runChat(messages: ChatMessage[]) {
  return ollama.chat({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    messages,
    options: { temperature: 0.9, top_p: 0.9 },
  });
}

export async function runStream(messages: ChatMessage[], onToken: (token: string) => void): Promise<string> {
  const response = await ollama.chat({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    messages,
    stream: true,
    options: { temperature: 0.9, top_p: 0.9 },
  });

  let full = "";
  for await (const chunk of response) {
    const token = chunk.message.content;
    if (!token) continue;
    full += token;
    onToken(token);
  }
  return full;
}
