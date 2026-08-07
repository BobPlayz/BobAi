import ollama from "ollama";

export async function streamChat(
  messages: { role: string; content: string }[],
  onToken: (token: string) => void
) {
  const response = await ollama.chat({
    model: "qwen2.5:3b",
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