import ollama from "ollama";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateConversationTitle(
  messages: ChatMessage[]
): Promise<string> {
  const sample = messages.slice(-8);

  const prompt = `
generate a very short conversation title.

rules:
- 2 to 5 words
- lowercase
- no quotes
- no punctuation
- summarize the actual topic

examples:
casual greeting
cyberpunk wallpaper
debugging usechat
exam study plan
discord bot economy

conversation:
${sample.map((m) => `${m.role}: ${m.content}`).join("\n")}
  `.trim();

  try {
    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      options: {
        temperature: 0.2,
      },
    });

    const title = response.message.content
      .trim()
      .replace(/["'.!,]/g, "")
      .slice(0, 40);

    return title || "new chat";
  } catch {
    return "new chat";
  }
}