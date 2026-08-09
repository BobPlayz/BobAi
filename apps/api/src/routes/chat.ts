import { Router } from "express";
import ollama from "ollama";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    const cleanMessages = rawMessages.map((m: any) => ({
      role:
        m.role === "assistant" || m.role === "system"
          ? m.role
          : "user",
      content:
        typeof m.content === "string"
          ? m.content
          : String(m.content ?? ""),
    }));

    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: cleanMessages,
      options: {
        temperature: 0.9,
        top_p: 0.9,
      },
    });

    res.json({
      reply: response.message.content,
      title: cleanMessages[0]?.content?.slice(0, 32) || "new chat",
      streamReady: true,
    });
  } catch (error) {
    console.error("CHAT ROUTE ERROR:", error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "chat failed",
    });
  }
});

export default router;