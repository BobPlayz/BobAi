import { Router } from "express";
import ollama from "ollama";

const router = Router();

router.post("/", async (req, res) => {
  const {
    message,
    systemPrompt,
  } = req.body as {
    message?: string;
    systemPrompt?: string;
  };

  if (!message) {
    return res.status(400).json({ error: "message required" });
  }

  try {
    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content:
            systemPrompt ??
            "you are bobai. talk casually and naturally.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      options: {
        temperature: 0.95,
        top_p: 0.9,
      },
    });

    return res.json({
      reply: response.message.content,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "ollama failed",
    });
  }
});

export default router;