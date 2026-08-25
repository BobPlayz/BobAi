import { Router } from "express";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { prepareChat, runChat } from "../services/chatEngine.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
    });

    if (prepared.validationError) {
      return res.status(400).json({ error: prepared.validationError });
    }

    if (prepared.memoryRequest) {
      return res.json({
        reply: "Got it. I will remember that for future conversations.",
        title: prepared.title,
        memoryStored: true,
      });
    }

    if (
      prepared.latestUserMessage &&
      isCodingTask(prepared.latestUserMessage.content) &&
      process.env.BOBAI_CODING_AGENTS_DIR
    ) {
      const result = await runCodingAgent(prepared.latestUserMessage.content);
      return res.json({
        reply: result.output || "The coding agent completed without output.",
        title: prepared.title,
        agent: "coding",
        warnings: result.warnings,
      });
    }

    const response = await runChat(prepared.ollamaMessages);

    return res.json({
      reply: response.message.content,
      title: prepared.title,
      streamReady: true,
    });
  } catch (error) {
    console.error("CHAT ROUTE ERROR:", error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : "chat failed",
    });
  }
});

export default router;
