import { randomUUID } from "node:crypto";
import { Router } from "express";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { prepareChat, runStream } from "../services/chatEngine.js";
import { dbRemember } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();

router.post("/", async (req, res) => {
  const { send } = initSSE(res);
  const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID();

  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
      modelId: req.body?.modelId,
    });

    if (prepared.validationError) {
      send("error", { message: prepared.validationError });
      return res.end();
    }

    if (prepared.memoryRequest && prepared.latestUserMessage) {
      const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() });
      if (!stored) {
        send("error", { message: "memory storage unavailable" });
        return res.end();
      }
      send("done", { reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, conversationId });
      return res.end();
    }

    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) {
      const result = await runCodingAgent(prepared.latestUserMessage.content);
      const reply = result.output || "the coding agent completed without output.";
      const persisted = await dbSaveConversation({
        id: conversationId,
        userId: req.user!.id,
        workspaceId: workspace.id,
        title: prepared.title,
        messages: [...prepared.messages, { id: randomUUID(), role: "assistant", content: reply, model: "coding-agent", status: "completed" }],
      }).catch(() => false);
      send("done", { reply, title: prepared.title, agent: "coding", warnings: result.warnings, conversationId, persisted });
      return res.end();
    }

    const full = await runStream(prepared.ollamaMessages, (token) => send("token", { token }), prepared.modelId);
    const persisted = await dbSaveConversation({
      id: conversationId,
      userId: req.user!.id,
      workspaceId: workspace.id,
      title: prepared.title,
      messages: [...prepared.messages, { id: randomUUID(), role: "assistant", content: full, model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen-3b", status: "completed" }],
    }).catch(() => false);

    send("done", {
      reply: full,
      title: prepared.title,
      model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen-3b",
      conversationId,
      persisted,
    });
    return res.end();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("STREAM ROUTE ERROR:", error);
    if (!res.writableEnded) {
      send("error", { message: error instanceof Error ? error.message : "stream failed" });
      res.end();
    }
  }
});

export default router;
