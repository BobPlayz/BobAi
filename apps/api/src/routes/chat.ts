import { Router } from "express";
import ollama from "ollama";
import { generateConversationTitle } from "../utils/titleGenerator";

const router = Router();

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function wantsImage(text: string): boolean {
  const lower = text.toLowerCase();

  return [
    "draw",
    "generate an image",
    "generate a picture",
    "create an image",
    "make me a",
    "make a wallpaper",
    "wallpaper",
    "logo",
    "illustration",
    "artwork",
    "render",
    "poster",
    "portrait",
    "anime style",
    "photo of",
    "concept art",
  ].some((k) => lower.includes(k));
}

router.post("/", async (req, res) => {
  try {
    const {
      messages,
      personality = "",
    } = req.body as {
      messages: ChatMessage[];
      personality?: string;
    };

    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (lastUser && wantsImage(lastUser.content)) {
      const title = await generateConversationTitle(messages);

      return res.json({
        reply: "",
        imagePrompt: lastUser.content,
        title,
      });
    }

    const systemPrompt = `
you are bobai.

default language: english only unless the user explicitly changes language.

talk naturally, casually, and like a real person.
keep grammar relaxed.
avoid sounding like a textbook.
adapt to the user's writing style over time.

never randomly switch languages.
never pretend to remember things outside the current conversation unless memory provides them.

user customization:
${personality || "none"}
`.trim();

    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      options: {
        temperature: 0.9,
        top_p: 0.9,
      },
    });

    const title = await generateConversationTitle([
      ...messages,
      {
        role: "assistant",
        content: response.message.content,
      },
    ]);

    return res.json({
      reply: response.message.content,
      title,
      streamReady: true,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "chat failed",
    });
  }
});

export default router;