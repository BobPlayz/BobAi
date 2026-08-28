import { Router } from "express";
import { prepareChat, runChat } from "../services/chatEngine.js";
import { queueBackgroundTask } from "../services/agentCoordinator.js";
import { isCodingTask } from "../services/codingAgent.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
      modelId: req.body?.modelId,
    });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });

    if (prepared.memoryRequest) {
      return res.json({
        reply: "got it. i will remember that for future conversations.",
        title: prepared.title,
        memoryStored: true,
        agent: "bob",
      });
    }

    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content)) {
      const job = queueBackgroundTask({
        description: prepared.latestUserMessage.content,
        mode: req.body?.mode,
        context: {
          workspaceId: typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined,
          createdBy: req.user?.id,
        },
      });

      return res.status(202).json({
        reply: `i've queued that for the coding agents. job ${job.id} is running only when a worker is available.`,
        title: prepared.title,
        agent: "bob",
        backgroundJobId: job.id,
        background: true,
      });
    }

    const response = await runChat(prepared.ollamaMessages, prepared.modelId);
    return res.json({
      reply: response.message.content,
      title: prepared.title,
      agent: "bob",
      model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen2.5:3b",
      streamReady: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("CHAT ROUTE ERROR:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "chat failed" });
  }
});

export default router;
