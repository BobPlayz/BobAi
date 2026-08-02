export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function sendMessage(message: string) {
  const response = await fetch(`${API_URL}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversationId: "local-dev",
      userId: "local-user",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  return response.json();
}

export async function loadConversation() {
  const response = await fetch(`${API_URL}/v1/conversations/local-dev`);

  if (!response.ok) {
    throw new Error("Failed to load conversation");
  }

  return response.json();
}