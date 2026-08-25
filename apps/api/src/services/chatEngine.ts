import ollama from "ollama";
import { memoryAsPrompt } from "../memory/memory.js";
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

export function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input.map((message: any) => ({
    role:
      message?.role === "assistant" || message?.role === "system"
        ? message.role
        : "user",
    content:
      typeof message?.content === "string"
        ? message.content
        : String(message?.content ?? ""),
  }));
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

default language: english only unless the user explicitly changes language.

talk naturally, casually, and like a real person.
keep grammar relaxed.
avoid sounding like a textbook.
adapt to the user's writing style over time.

never randomly switch languages.
never pretend to remember things outside the current conversation unless memory provides them.

user customization:
${personality || "none"}

relevant saved memory:
${memoryAsPrompt()}`,
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
    memoryRequest: Boolean(latestUserMessage && extractMemory(latestUserMessage.content)),
    ollamaMessages: [buildSystemPrompt(personality), ...messages],
    title:
      latestUserMessage?.content?.slice(0, 32) ||
      messages[0]?.content?.slice(0, 32) ||
      "new chat",
  };
}

export async function runChat(messages: ChatMessage[]) {
  return ollama.chat({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    messages,
    options: {
      temperature: 0.9,
      top_p: 0.9,
    },
  });
}

export async function runStream(
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<string> {
  const response = await ollama.chat({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    messages,
    stream: true,
    options: {
      temperature: 0.9,
      top_p: 0.9,
    },
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
