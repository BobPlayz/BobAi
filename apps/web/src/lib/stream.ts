import type { ChatMessage } from "@/types/chat";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function streamMessage(
  messages: ChatMessage[],
  personality: string,
  handlers: {
    onToken: (token: string) => void;
    onDone: (reply: string) => void;
    onError: (message: string) => void;
  }
) {
  const response = await fetch(`${API_BASE}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      personality,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("stream request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, {
      stream: true,
    });

    const parts = buffer.split("\\n\\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\\n");

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        }

        if (line.startsWith("data: ")) {
          const payload = JSON.parse(line.slice(6));

          if (currentEvent === "token") {
            handlers.onToken(payload.token);
          }

          if (currentEvent === "done") {
            handlers.onDone(payload.reply);
          }

          if (currentEvent === "error") {
            handlers.onError(payload.message);
          }
        }
      }
    }
  }
}