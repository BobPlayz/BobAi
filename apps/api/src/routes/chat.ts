import { randomUUID } from "node:crypto";
import { Router } from "express";
import { prepareChat, runChat } from "../services/chatEngine.js";
import { queueBackgroundTask } from "../services/agentCoordinator.js";
import { isCodingTask } from "../services/codingAgent.js";
import { dbRecallAll, dbRemember } from "../store/memoryDb.js";
import { dbGetConversation, dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const memories = await dbRecallAll(workspace.id, req.user!.id);
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
      modelId: req.body?.modelId,
      memoryContext: memories?.map((memory) => `${memory.key}: ${memory.value}`) || [],
    });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });

    if (prepared.memoryRequest && prepared.latestUserMessage) {
      const stored = await dbRemember({
        workspaceId: workspace.id,
        userId: req.user!.id,
        key: "explicit memory",
        value: prepared.latestUserMessage.content.trim(),
      });
      if (!stored) return res.status(503).json({ error: "memory storage unavailable" });
      return res.json({ reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, agent: "bob" });
    }

    const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim()
      ? req.body.conversationId.trim()
      : randomUUID();
    const requestedMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];

    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content)) {
      const job = queueBackgroundTask({ description: prepared.latestUserMessage.content, mode: req.body?.mode, context: { workspaceId: workspace.id, createdBy: req.user?.id } });
      await dbSaveConversation({
        id: conversationId,
        userId: req.user!.id,
        workspaceId: workspace.id,
        title: prepared.title,
        messages: requestedMessages.map((message: any) => ({
          id: typeof message?.id === "string" ? message.id : randomUUID(),
          role: typeof message?.role === "string" ? message.role : "user",
          content: typeof message?.content === "string" ? message.content : "",
          model: typeof message?.model === "string" ? message.model : null,
          status: "completed",
          attachments: message?.attachments,
        })),
      }).catch(() => false);
      return res.status(202).json({ reply: `i've queued that for the coding agents. job ${job.id} is running only when a worker is available.`, title: prepared.title, agent: "bob", backgroundJobId: job.id, background: true, conversationId });
    }

    const response = await runChat(prepared.ollamaMessages, prepared.modelId);
    const assistantMessage = {
      id: randomUUID(),
      role: "assistant",
      content: response.message.content,
      model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen2.5:3b",
      status: "completed",
    };
    const persisted = await dbSaveConversation({
      id: conversationId,
      userId: req.user!.id,
      workspaceId: workspace.id,
      title: prepared.title,
      messages: [
        ...requestedMessages.map((message: any) => ({
          id: typeof message?.id === "string" ? message.id : randomUUID(),
          role: typeof message?.role === "string" ? message.role : "user",
          content: typeof message?.content === "string" ? message.content : "",
          model: typeof message?.model === "string" ? message.model : null,
          status: typeof message?.status === "string" ? message.status : "completed",
          attachments: message?.attachments,
        })),
        assistantMessage,
      ],
    }).catch(() => false);

    return res.json({
      reply: response.message.content,
      title: prepared.title,
      agent: "bob",
      model: assistantMessage.model,
      streamReady: true,
      conversationId,
      persisted,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("CHAT ROUTE ERROR:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "chat failed" });
  }
});

export default router;
