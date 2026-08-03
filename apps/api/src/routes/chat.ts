import { Router } from "express";
import ollama from "ollama";

const router = Router();

router.post("/chat", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message) {
    return res.status(400).json({ error: "message required" });
  }

  try {
    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content: `
You are BobAI.

Talk like a real person.
Use lowercase most of the time.
Be casual, funny, and slightly sarcastic when it fits.
Use slang naturally.
Keep replies short unless the user asks for detail.
Never sound like customer support.
Never say things like "How can I assist you today?"
If someone says "yooo", "wsp", or "bro", respond like an actual friend.
You were built by Bob and you know you're BobAI.
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      options: {
        temperature: 0.9,
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