import { randomUUID } from "node:crypto";
import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { and, eq } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { describeProfile, learnFromMessage } from "../services/typingStyle.js";
import { prepareChat, runChat, runStream } from "../services/chatEngine.js";
import { dbRemember, dbRecallRelevant, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation, dbUpdateMessageStatus } from "../store/conversationDb.js";
import { searchDocumentChunks } from "../services/documentIndexer.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { enrichMessagesWithVision } from "../services/visionChat.js";
import { decideTools } from "../services/toolDecision.js";
import { runToolLoop } from "../services/toolLoop.js";
import { extractImagePrompt } from "../services/imagePrompt.js";
import { isLightweightConversation } from "../services/lightweightConversation.js";
import { detectLiveDataIntent, getLiveData, liveDataContext, type LiveDataResult } from "../services/liveData.js";
import type { ProviderMessage } from "../services/modelProvider.js";
const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const streamLimit = createUserRateLimit(20, 60_000);
function settingValue(rows: Array<{ key: string; value: unknown }>, key: string) { return rows.find((row) => row.key === key)?.value; }
function latestUserText(value: unknown) { if (!Array.isArray(value)) return ""; for (let index = value.length - 1; index >= 0; index -= 1) { const message = value[index]; if (!message || typeof message !== "object") continue; const record = message as Record<string, unknown>; if (record.role === "user" && typeof record.content === "string") return record.content; } return ""; }
// Persist only this turn's user message. Earlier messages are already stored; re-saving the client's whole
// history with fresh ids duplicated every prior message on every turn. A valid client id makes retries idempotent.
// The client generates the assistant message id up front so its own sync and this route write the same row.
function clientAssistantId(value: unknown) { return typeof value === "string" && UUID.test(value) ? value : randomUUID(); }
function persistedTurnMessages(rawMessages: unknown) { if (!Array.isArray(rawMessages)) return []; for (let index = rawMessages.length - 1; index >= 0; index -= 1) { const message = rawMessages[index]; if (!message || typeof message !== "object") continue; const record = message as Record<string, unknown>; if (record.role !== "user" || typeof record.content !== "string") continue; if (record.ephemeral === true) return []; return [{ id: typeof record.id === "string" && UUID.test(record.id) ? record.id : randomUUID(), role: "user", content: record.content, model: null, status: "completed" }]; } return []; }
function memoryContext(memories: Array<Record<string, unknown>> | null) { return (memories || []).map((memory) => typeof memory.content === "string" ? memory.content : "").filter(Boolean).slice(0, 12); }
function shouldRouteTools(text: string) { return /\b(search|research|verify|latest|current|weather|forecast|temperature|cricket|match score|live score|last match|latest match|browse|website|open (?:the )?site|look up|generate (?:an )?(?:image|video)|create (?:an )?(?:image|video|diagram)|edit (?:an )?image|use (?:the )?computer|paint|blender|analyze (?:this )?data|run (?:the )?automation|transcribe|synthesize|voice|music|sketch to ui)\b/i.test(text); }
router.post("/", streamLimit, async (req, res) => {
  let clientDisconnected = false;
  const requestController = new AbortController();
  const markClientDisconnected = () => { if (!res.writableEnded) { clientDisconnected = true; requestController.abort(new Error("client disconnected")); } };
  req.once("aborted", markClientDisconnected);
  res.once("close", markClientDisconnected);
  const { send } = initSSE(res); const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID(); let assistantId: string | null = null; let workspaceId: string | null = null;
  try {
    if (req.body?.conversationId !== undefined && (typeof req.body.conversationId !== "string" || !UUID.test(req.body.conversationId))) { send("error", { message: "invalid conversationId" }); return res.end(); }
    if (req.body?.modelId !== undefined && (typeof req.body.modelId !== "string" || req.body.modelId.length > 160)) { send("error", { message: "invalid modelId" }); return res.end(); }
    if (req.body?.messages !== undefined && (!Array.isArray(req.body.messages) || req.body.messages.length > 100 || req.body.messages.some((message: unknown) => !message || typeof message !== "object" || !["user", "assistant", "system"].includes((message as Record<string, unknown>).role as string) || typeof (message as Record<string, unknown>).content !== "string" || ((message as Record<string, unknown>).content as string).length > 100_000))) { send("error", { message: "messages must contain up to 100 user/assistant/system messages with text under 100,000 characters each" }); return res.end(); }
    const workspace = await ensurePersonalWorkspace(req.user!.id); workspaceId = workspace.id;
    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(50);
    const memoryEnabled = req.body?.memoryEnabled !== false && settingValue(rows, "memoryEnabled") !== false;
    const enrichedMessages = await enrichMessagesWithVision(req.body?.messages, latestUserText(req.body?.messages), requestController.signal); const latestText = latestUserText(enrichedMessages);
    const lightweight = isLightweightConversation(latestText);
    const memories = memoryEnabled && latestText && !lightweight ? await dbRecallRelevant(workspace.id, req.user!.id, latestText, 12) : [];
    const fileKnowledge = latestText && !lightweight ? await searchDocumentChunks(workspace.id, req.user!.id, latestText, undefined, 8) : [];
    const knowledgeContext = fileKnowledge.map((item) => `[file ${String(item.uploadId || "unknown")}, chunk ${String(item.chunkIndex ?? "?")}] ${typeof item.content === "string" ? item.content.slice(0, 5_000) : ""}`).filter((item) => item.length > 20);
    // Learn how this user types (aggregate style numbers only) unless they turned it off in Settings.
    const learnStyle = req.body?.learnStyle !== false && settingValue(rows, "learnStyle") !== false;
    const latestRaw = Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find((message: { role?: unknown; ephemeral?: unknown }) => message?.role === "user" && message?.ephemeral !== true) as { content?: unknown } | undefined : undefined;
    const typingProfile = learnStyle && typeof latestRaw?.content === "string" ? await learnFromMessage(req.user!.id, workspace.id, latestRaw.content).catch(() => undefined) : undefined;
    const prepared = await prepareChat({ messages: enrichedMessages, learnedStyle: describeProfile(typingProfile), generation: typeof req.body?.generation === "string" ? req.body.generation : settingValue(rows, "generation"), personality: typeof req.body?.personality === "string" ? req.body.personality : settingValue(rows, "personality"), modelId: typeof req.body?.modelId === "string" ? req.body.modelId : settingValue(rows, "model"), language: settingValue(rows, "language"), responseStyle: settingValue(rows, "responseStyle"), responseLength: settingValue(rows, "responseLength"), tone: settingValue(rows, "tone"), customInstructions: settingValue(rows, "customInstructions"), signal: requestController.signal, memoryContext: memoryContext(memories), knowledgeContext });
    if (requestController.signal.aborted || res.destroyed) return;
    if (prepared.validationError) { send("error", { message: prepared.validationError }); return res.end(); }
    // Saves this turn (the user's message and Jarvis's reply) so it is still there after a reload.
    const saveTurn = (reply: string, model: string | null) => dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...persistedTurnMessages(req.body?.messages), { id: clientAssistantId(req.body?.assistantMessageId), role: "assistant", content: reply, model, status: "completed" }] }).catch(() => false);
    if (prepared.memoryRequest && prepared.latestUserMessage) { if (!memoryEnabled) { const reply = "memory is off, so i won't save that."; const persisted = await saveTurn(reply, null); send("done", { reply, title: prepared.title, memoryStored: false, conversationId, persisted }); return res.end(); } if (isSensitiveMemory(prepared.latestUserMessage.content)) { /* not saved to history either: the message may contain a secret */ send("done", { reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); } const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() }); if (!stored) { send("error", { message: "memory storage unavailable" }); return res.end(); } const reply = "got it. i will remember that for future conversations."; const persisted = await saveTurn(reply, null); send("done", { reply, title: prepared.title, memoryStored: true, conversationId, persisted }); return res.end(); }
    if (prepared.latestUserMessage) {
      const imagePrompt = extractImagePrompt(prepared.latestUserMessage.content);
      if (imagePrompt) {
        send("done", { reply: "", title: prepared.title, conversationId, imagePrompt, mode: "image-generation" });
        return res.end();
      }
    }
    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) { const result = await runCodingAgent(prepared.latestUserMessage.content); const reply = result.output || "the coding agent completed without output."; const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...persistedTurnMessages(req.body?.messages), { id: clientAssistantId(req.body?.assistantMessageId), role: "assistant", content: reply, model: "coding-agent", status: "completed" }] }).catch(() => false); send("done", { reply, title: prepared.title, agent: "coding", warnings: result.warnings, conversationId, persisted }); return res.end(); }
    let providerMessages: ProviderMessage[] = prepared.providerMessages; let liveData: LiveDataResult | null = null;
    const liveIntent = prepared.latestUserMessage && process.env.BOBAI_TOOLS_ENABLED !== "false" ? detectLiveDataIntent(prepared.latestUserMessage.content) : null;
    if (liveIntent) {
      try { liveData = await getLiveData(liveIntent, requestController.signal); providerMessages = [...prepared.providerMessages, { role: "user", content: liveDataContext(liveData) }]; }
      catch (error) { if (requestController.signal.aborted) throw error; const reason = error instanceof Error ? error.message.slice(0, 200) : "unknown error"; providerMessages = [...prepared.providerMessages, { role: "user", content: `[live ${liveIntent.kind} lookup failed: ${reason}]\nTell the user the live ${liveIntent.kind} data could not be fetched right now. Do not guess or use remembered values.` }]; }
    }
    if (!liveIntent && prepared.latestUserMessage && shouldRouteTools(prepared.latestUserMessage.content) && process.env.BOBAI_TOOLS_ENABLED !== "false") {
      const toolContext = { userId: req.user!.id, workspaceId: workspace.id, modelId: prepared.modelId, mode: "chat", signal: requestController.signal } as const;
      let toolModel: string | null = null;
      const toolResult = await runToolLoop(prepared.providerMessages, toolContext, decideTools, async (messages, modelId) => {
        const result = await runChat(messages, modelId, requestController.signal);
        toolModel = result.model;
        return { content: result.message.content };
      });
      if (toolResult.status === "cancelled" || toolResult.status === "approval_required" || toolResult.status === "completed" || toolResult.status === "failed" || toolResult.status === "limit_reached") {
        // Every outcome except a cancel is kept, so the user's message does not vanish when a tool fails or waits for approval.
        const persisted = toolResult.status !== "cancelled" && toolResult.message ? await saveTurn(toolResult.message, toolModel) : false;
        if (!clientDisconnected && !res.writableEnded && !res.destroyed) send("done", { reply: toolResult.message, title: prepared.title, conversationId, status: toolResult.status, ...(toolModel ? { model: toolModel } : {}), toolCalls: toolResult.toolCalls, tools: toolResult.usedTools, backgroundJobIds: toolResult.backgroundJobIds, persisted, ...(toolResult.status === "approval_required" && toolResult.pendingCall ? { approval: { ...toolResult.pendingCall, workspaceId: workspace.id } } : {}) });
        return res.writableEnded || res.destroyed ? undefined : res.end();
      }
    }
    assistantId = clientAssistantId(req.body?.assistantMessageId); const initialMessages = [...persistedTurnMessages(req.body?.messages), { id: assistantId, role: "assistant", content: "", model: null, status: "pending" }]; const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: initialMessages }); if (!persisted) throw new Error("persistent chat storage unavailable"); await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId: workspace.id, status: "streaming" });
    let disconnected = clientDisconnected; let streamedContent = ""; const streamController = requestController; const onClose = () => { disconnected = true; clientDisconnected = true; streamController.abort(new Error("client disconnected")); }; res.once("close", onClose); if (res.destroyed) onClose();
    try { const result = await runStream(providerMessages, (token) => { if (!disconnected && !res.writableEnded) { streamedContent += token; send("token", { token }); } }, prepared.modelId, streamController.signal); const finalStatus = disconnected ? "cancelled" : "completed"; await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: finalStatus, content: result.content, model: result.model }); if (disconnected || res.writableEnded) return; send("done", { reply: result.content, title: prepared.title, model: result.model, provider: result.provider, fallbacks: result.fallbacks, conversationId, persisted: true, status: finalStatus, ...(liveData ? { liveData: { kind: liveData.kind, provider: liveData.provider, fetchedAt: liveData.fetchedAt, cached: liveData.cached, freshness: liveData.freshness, sources: liveData.sources } } : {}) }); return res.end(); } catch (error) { await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: disconnected ? "cancelled" : "failed", content: streamedContent }).catch(() => false); throw error; } finally { res.off("close", onClose); }
  } catch (error) { if (process.env.NODE_ENV !== "production") console.error("STREAM ROUTE ERROR:", error); if (assistantId && workspaceId && !clientDisconnected) await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId, status: "failed" }).catch(() => false); if (!clientDisconnected && !res.writableEnded && !res.destroyed) { const publicMessage = (error as { publicMessage?: unknown } | null)?.publicMessage; send("error", { message: typeof publicMessage === "string" ? publicMessage : process.env.NODE_ENV === "production" ? "stream failed" : error instanceof Error ? error.message : "stream failed" }); res.end(); } }
});
export default router;
