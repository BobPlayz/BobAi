import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { prepareChat, runChat } from "../services/chatEngine.js";
import { queueBackgroundTask } from "../services/agentCoordinator.js";
import { isCodingTask } from "../services/codingAgent.js";
import { dbRecallRelevant, dbRemember, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const MAX_SETTINGS_LOOKUP = 20;

function relevantMemories(memories: Array<{ key?: string; value?: string; category?: string; content?: string }> | null, query: string) {
  if (!memories?.length) return [];
  return memories.slice(0, 12).map((memory) => `${memory.key || memory.category || "memory"}: ${memory.value || memory.content || ""}`);
}
function settingValue(rows: Array<{ key: string; value: unknown }>, key: string) { return rows.find((row) => row.key === key)?.value; }

router.post("/", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(MAX_SETTINGS_LOOKUP);
    const storedPersonality = settingValue(rows, "personality");
    const storedModel = settingValue(rows, "model");
    const storedLanguage = settingValue(rows, "language");
    const storedResponseStyle = settingValue(rows, "responseStyle");
    const storedMemory = settingValue(rows, "memoryEnabled");
    const memoryEnabled = req.body?.memoryEnabled !== false && storedMemory !== false;
    const latestText = Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find((message: any) => message?.role === "user")?.content || "" : "";
    const memories = memoryEnabled ? await dbRecallRelevant(workspace.id, req.user!.id, typeof latestText === "string" ? latestText : "") : [];
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: typeof req.body?.personality === "string" ? req.body.personality : storedPersonality,
      modelId: typeof req.body?.modelId === "string" ? req.body.modelId : storedModel,
      language: storedLanguage,
      responseStyle: storedResponseStyle,
      memoryContext: relevantMemories(memories, typeof latestText === "string" ? latestText : ""),
    });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });

    if (prepared.memoryRequest && prepared.latestUserMessage) {
      if (!memoryEnabled) return res.json({ reply: "memory is off, so i won't save that.", title: prepared.title, memoryStored: false, agent: "bob" });
      if (isSensitiveMemory(prepared.latestUserMessage.content)) return res.json({ reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, agent: "bob" });
      const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() });
      if (!stored) return res.status(503).json({ error: "memory storage unavailable" });
      return res.json({ reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, agent: "bob" });
    }

    const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID();
    const requestedMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content)) {
      const job = queueBackgroundTask({ description: prepared.latestUserMessage.content, mode: req.body?.mode, context: { workspaceId: workspace.id, createdBy: req.user?.id } });
      await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: requestedMessages.map((message: any) => ({ id: typeof message?.id === "string" ? message.id : randomUUID(), role: typeof message?.role === "string" ? message.role : "user", content: typeof message?.content === "string" ? message.content : "", model: typeof message?.model === "string" ? message.model : null, status: "completed", attachments: message?.attachments })) }).catch(() => false);
      return res.status(202).json({ reply: `i've queued that for the coding agents. job ${job.id} is running only when a worker is available.`, title: prepared.title, agent: "bob", backgroundJobId: job.id, background: true, conversationId });
    }

    const response = await runChat(prepared.providerMessages, prepared.modelId);
    const assistantMessage = { id: randomUUID(), role: "assistant", content: response.message.content, model: response.model, status: "completed" };
    const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...requestedMessages.map((message: any) => ({ id: typeof message?.id === "string" ? message.id : randomUUID(), role: typeof message?.role === "string" ? message.role : "user", content: typeof message?.content === "string" ? message.content : "", model: typeof message?.model === "string" ? message.model : null, status: typeof message?.status === "string" ? message.status : "completed", attachments: message?.attachments })), assistantMessage] }).catch(() => false);
    return res.json({ reply: response.message.content, title: prepared.title, agent: "bob", model: response.model, provider: response.provider, streamReady: true, conversationId, persisted });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("CHAT ROUTE ERROR:", error);
    return res.status(500).json({ error: process.env.NODE_ENV === "production" ? "chat failed" : error instanceof Error ? error.message : "chat failed" });
  }
});

export default router;
