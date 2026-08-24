import ollama from "ollama";

export type StreamMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function streamSession(
  messages: StreamMessage[],
  onToken: (token: string) => void
): Promise<string> {
  const response = await ollama.chat({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    messages,
    stream: true,
  });

  let full = "";

  for await (const chunk of response) {
    const token = chunk.message.content;
    full += token;
    onToken(token);
  }

  return full;
}