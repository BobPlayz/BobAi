import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { prepareChat, runStream } from "../services/chatEngine.js";
import { dbRemember, dbRecallRelevant, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation, dbUpdateMessageStatus } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
function settingValue(rows: Array<{ key: string; value: unknown }>, key: string) { return rows.find((row) => row.key === key)?.value; }
function persistedInputMessages(messages: Array<{ role: string; content: string }>) { return messages.map((message) => ({ id: randomUUID(), role: message.role, content: message.content, model: null, status: "completed" })); }
function memoryContext(memories: Array<Record<string, unknown>> | null) { return (memories || []).map((memory) => typeof memory.content === "string" ? memory.content : "").filter(Boolean).slice(0, 12); }

router.post("/", async (req, res) => {
  const { send } = initSSE(res);
  const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID();
  let assistantId: string | null = null;
  let workspaceId: string | null = null;
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    workspaceId = workspace.id;
    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(50);
    const memoryEnabled = req.body?.memoryEnabled !== false && settingValue(rows, "memoryEnabled") !== false;
    const latestText = Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find((message: unknown) => typeof message === "object" && message !== null && (message as Record<string, unknown>).role === "user")?.content || "" : "";
    const memories = memoryEnabled && typeof latestText === "string" ? await dbRecallRelevant(workspace.id, req.user!.id, latestText, 12) : [];
    const prepared = prepareChat({ messages: req.body?.messages, personality: typeof req.body?.personality === "string" ? req.body.personality : settingValue(rows, "personality"), modelId: typeof req.body?.modelId === "string" ? req.body.modelId : settingValue(rows, "model"), language: settingValue(rows, "language"), responseStyle: settingValue(rows, "responseStyle"), memoryContext: memoryContext(memories) });
    if (prepared.validationError) { send("error", { message: prepared.validationError }); return res.end(); }
    if (prepared.memoryRequest && prepared.latestUserMessage) {
      if (!memoryEnabled) { send("done", { reply: "memory is off, so i won't save that.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); }
      if (isSensitiveMemory(prepared.latestUserMessage.content)) { send("done", { reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); }
      const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() });
      if (!stored) { send("error", { message: "memory storage unavailable" }); return res.end(); }
      send("done", { reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, conversationId }); return res.end();
    }
    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) {
      const result = await runCodingAgent(prepared.latestUserMessage.content);
      const reply = result.output || "the coding agent completed without output.";
      const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...persistedInputMessages(prepared.messages), { id: randomUUID(), role: "assistant", content: reply, model: "coding-agent", status: "completed" }] }).catch(() => false);
      send("done", { reply, title: prepared.title, agent: "coding", warnings: result.warnings, conversationId, persisted }); return res.end();
    }

    assistantId = randomUUID();
    const initialMessages = [...persistedInputMessages(prepared.messages), { id: assistantId, role: "assistant", content: "", model: null, status: "pending" }];
    const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: initialMessages });
    if (!persisted) throw new Error("persistent chat storage unavailable");
    await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId: workspace.id, status: "streaming" });

    let disconnected = false;
    const onClose = () => { disconnected = true; };
    req.once("close", onClose);
    try {
      const result = await runStream(prepared.providerMessages, (token) => { if (!disconnected && !res.writableEnded) send("token", { token }); }, prepared.modelId);
      const finalStatus = disconnected ? "cancelled" : "completed";
      await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: finalStatus, content: result.content, model: result.model });
      if (disconnected || res.writableEnded) return;
      send("done", { reply: result.content, title: prepared.title, model: result.model, provider: result.provider, conversationId, persisted: true, status: finalStatus });
      return res.end();
    } catch (error) {
      await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: disconnected ? "cancelled" : "failed", content: "" }).catch(() => false);
      throw error;
    } finally { req.off("close", onClose); }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("STREAM ROUTE ERROR:", error);
    if (assistantId && workspaceId) await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId, status: "failed" }).catch(() => false);
    if (!res.writableEnded) { send("error", { message: process.env.NODE_ENV === "production" ? "stream failed" : error instanceof Error ? error.message : "stream failed" }); res.end(); }
  }
});
export default router;
