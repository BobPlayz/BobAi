import { Router } from "express";
import ollama from "ollama";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { memoryAsPrompt } from "../memory/memory.js";
import { extractMemory } from "../utils/memoryExtractor.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const personality = typeof body.personality === "string" ? body.personality.trim() : "";

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
    const latestUserMessage = [...cleanMessages].reverse().find((message) => message.role === "user");

    if (latestUserMessage && extractMemory(latestUserMessage.content)) {
      return res.json({
        reply: "Got it. I will remember that for future conversations.",
        title: latestUserMessage.content.slice(0, 32) || "memory update",
        memoryStored: true,
      });
    }

    if (latestUserMessage && isCodingTask(latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) {
      const result = await runCodingAgent(latestUserMessage.content);
      return res.json({
        reply: result.output || "The coding agent completed without output.",
        title: latestUserMessage.content.slice(0, 32) || "coding task",
        agent: "coding",
        warnings: result.warnings,
      });
    }

    const response = await ollama.chat({
      model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content: `You are BobAI. Respond naturally and clearly.
User preferences: ${personality || "none"}
Relevant saved memory:
${memoryAsPrompt()}`,
        },
        ...cleanMessages,
      ],
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