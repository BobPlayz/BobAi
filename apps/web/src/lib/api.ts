import type { ChatMessage } from "@/types/chat";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function sendMessage(
  messages: ChatMessage[],
  personality = ""
): Promise<{
  reply: string;
  imagePrompt?: string;
  title?: string;
}> {
  const response = await fetch(`${API_BASE}/chat`, {
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

  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }

  return response.json();
}

export async function generateImage(
  prompt: string
): Promise<{
  images: {
    url: string;
    prompt: string;
  }[];
}> {
  const response = await fetch(`${API_BASE}/images/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`image generation failed: ${response.status}`);
  }

  return response.json();
}