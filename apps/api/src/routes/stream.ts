import { randomUUID } from "node:crypto";
import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { and, eq } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { describeProfile, learnFromMessage } from "../services/typingStyle.js";
import { consumeQuota, quotaMessage } from "../services/usageLimits.js";
import { isLanguage } from "../services/language.js";
import { MAX_CONTINUATIONS, continuationEmitter, continuePrompt, hasOpenFence } from "../services/continuation.js";
import { extractHtml, localSitesEnabled, saveLocalSite, wantsLocalSite } from "../services/localSites.js";
import { prepareChat, runChat, runStream } from "../services/chatEngine.js";
import { dbRemember, dbRecallRelevant, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation, dbUpdateMessageStatus, dbLoadCompaction, dbSaveCompaction } from "../store/conversationDb.js";
import { searchDocumentChunks } from "../services/documentIndexer.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { enrichMessagesWithVision } from "../services/visionChat.js";
import { decideTools } from "../services/toolDecision.js";
import { runToolLoop } from "../services/toolLoop.js";
import { extractImagePrompt } from "../services/imagePrompt.js";
import { isLightweightConversation } from "../services/lightweightConversation.js";
import { detectLiveDataIntent, formatSportsEvidence, getLiveData, liveDataContext, type LiveDataResult } from "../services/liveData.js";
import { calculatorCodeBlock, isCalculatorBuildRequest } from "../services/calculatorTemplate.js";
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
/** "Build/make/write a website, app, game, page…" is a coding request: it streams like any reply (with cut-off
 * protection) instead of going through the tool loop, which only answers once everything is finished. */
function wantsToBuild(text: string) { return /\b(build|make|create|write|code|design|generate|program)\b[\s\S]{0,60}\b(website|site|web ?page|page|app|game|calculator|quiz|form|landing|portfolio|html|css|javascript|script|program)\b/i.test(text); }
function shouldRouteTools(text: string) { return /\b(search|research|verify|latest|current|weather|forecast|temperature|cricket|match score|live score|last match|latest match|browse|browser agent|run browser|use browser|website|open (?:the )?(?:site|website|url|link|jarvis|browser agent)|open\s+(?:\[)?https?:\/\/|navigate to (?:the )?(?:site|website|url|link|jarvis)|look up|generate (?:an )?(?:image|video)|create (?:an )?(?:image|video|diagram)|edit (?:an )?image|use (?:the )?computer|paint|blender|analyze (?:this )?data|run (?:the )?automation|transcribe|synthesize|voice|music|sketch to ui)\b/i.test(text); }
/** Replies being written right now, so an explicit Stop can end one (best effort: same server instance). */
const activeGenerations = new Map<string, { userId: string; controller: AbortController }>();
router.post("/cancel", async (req, res) => {
  const id = typeof req.body?.assistantMessageId === "string" ? req.body.assistantMessageId : "";
  const active = activeGenerations.get(id);
  if (active && active.userId === req.user!.id) active.controller.abort(new Error("stopped by the user"));
  return res.status(204).send();
});

router.post("/", streamLimit, async (req, res) => {
  let clientDisconnected = false;
  const requestController = new AbortController();
  // A dropped connection (reload, closed tab, bad signal) is only noted: the message is still answered and saved, so
  // nothing the user sent is lost. Only an explicit Stop (POST /stream/cancel) cancels.
  const markClientDisconnected = () => { if (!res.writableEnded) clientDisconnected = true; };
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
    // Daily message limits keep Jarvis inside its free AI allowance (per person, then for the whole site).
    for (const [quota, scope] of [["chat_user", req.user!.id], ["chat_site", "site"]] as const) {
      const state = await consumeQuota(quota, scope);
      if (!state.allowed) { send("error", { message: quotaMessage(state), limit: { name: state.name, used: state.limit, limit: state.limit, resetsAt: state.resetsAt } }); return res.end(); }
    }
    // Learn how this user types (aggregate style numbers only) unless they turned it off in Settings.
    const learnStyle = req.body?.learnStyle !== false && settingValue(rows, "learnStyle") !== false;
    const latestRaw = Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find((message: { role?: unknown; ephemeral?: unknown }) => message?.role === "user" && message?.ephemeral !== true) as { content?: unknown } | undefined : undefined;
    const typingProfile = learnStyle && typeof latestRaw?.content === "string" ? await learnFromMessage(req.user!.id, workspace.id, latestRaw.content).catch(() => undefined) : undefined;
    const compactionCache = { load: () => dbLoadCompaction(conversationId, req.user!.id, workspace.id), save: (state: { summary: string; covered: number; hash: string }) => dbSaveCompaction(conversationId, req.user!.id, workspace.id, state) };
    const prepared = await prepareChat({ messages: enrichedMessages, compactionCache, learnedStyle: describeProfile(typingProfile), spoken: req.body?.voice === true, askBeforeBuilding: req.body?.askBeforeBuilding !== false, generation: typeof req.body?.generation === "string" ? req.body.generation : settingValue(rows, "generation"), personality: typeof req.body?.personality === "string" ? req.body.personality : settingValue(rows, "personality"), modelId: typeof req.body?.modelId === "string" ? req.body.modelId : settingValue(rows, "model"), language: isLanguage(req.body?.language) ? req.body.language : settingValue(rows, "language"), responseStyle: settingValue(rows, "responseStyle"), responseLength: settingValue(rows, "responseLength"), tone: settingValue(rows, "tone"), customInstructions: settingValue(rows, "customInstructions"), signal: requestController.signal, memoryContext: memoryContext(memories), knowledgeContext });
    if (requestController.signal.aborted) return;
    if (prepared.validationError) { send("error", { message: prepared.validationError }); return res.end(); }
    // Every website Jarvis writes on a local computer is saved and hosted on localhost and hand back its local address (local computer only).
    const localSiteFor = async (reply: string) => {
      const request = prepared.latestUserMessage?.content ?? "";
      const html = localSitesEnabled() ? extractHtml(reply) : "";
      if (!html) return {};
      const site = await saveLocalSite(html, prepared.website ? `${request} ${prepared.website.request}` : request, Number(process.env.PORT || 3001)).catch(() => null);
      return site ? { localSite: { url: site.url, name: site.slug } } : {};
    };
    // Saves this turn (the user's message and Jarvis's reply) so it is still there after a reload.
    const saveTurn = (reply: string, model: string | null) => dbSaveConversation({ keepTitle: true, id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...persistedTurnMessages(req.body?.messages), { id: clientAssistantId(req.body?.assistantMessageId), role: "assistant", content: reply, model, status: "completed" }] }).catch(() => false);
    if (prepared.memoryRequest && prepared.latestUserMessage) { if (!memoryEnabled) { const reply = "memory is off, so i won't save that."; const persisted = await saveTurn(reply, null); send("done", { reply, title: prepared.title, memoryStored: false, conversationId, persisted }); return res.end(); } if (isSensitiveMemory(prepared.latestUserMessage.content)) { /* not saved to history either: the message may contain a secret */ send("done", { reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); } const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() }); if (!stored) { send("error", { message: "memory storage unavailable" }); return res.end(); } const reply = "got it. i will remember that for future conversations."; const persisted = await saveTurn(reply, null); send("done", { reply, title: prepared.title, memoryStored: true, conversationId, persisted }); return res.end(); }
    // Route image requests from the original user text first. prepareChat may rewrite or enrich the
    // latest message, which must not turn an explicit image-generation request into ordinary chat.
    const rawImagePrompt = typeof latestRaw?.content === "string" ? extractImagePrompt(latestRaw.content) : null;
    const preparedImagePrompt = prepared.latestUserMessage
      ? extractImagePrompt(prepared.latestUserMessage.content)
      : null;
    const imagePrompt = rawImagePrompt ?? preparedImagePrompt;
    if (imagePrompt) {
      send("done", { reply: "", title: prepared.title, conversationId, imagePrompt, mode: "image-generation" });
      return res.end();
    }
    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) { const result = await runCodingAgent(prepared.latestUserMessage.content); const reply = result.output || "the coding agent completed without output."; const persisted = await dbSaveConversation({ keepTitle: true, id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...persistedTurnMessages(req.body?.messages), { id: clientAssistantId(req.body?.assistantMessageId), role: "assistant", content: reply, model: "coding-agent", status: "completed" }] }).catch(() => false); send("done", { reply, title: prepared.title, agent: "coding", warnings: result.warnings, conversationId, persisted }); return res.end(); }
    let providerMessages: ProviderMessage[] = prepared.providerMessages; let liveData: LiveDataResult | null = null;
    const recentUserContext = prepared.providerMessages.filter((message) => message.role === "user").slice(-4).map((message) => message.content).join("\n");
    const liveIntent = detectLiveDataIntent(recentUserContext || prepared.latestUserMessage?.content || "");
    if (liveIntent) {
      try {
        liveData = await getLiveData(liveIntent, requestController.signal);
        if (liveData.kind === "sports") {
          const reply = formatSportsEvidence(liveData);
          const persisted = await saveTurn(reply, null);
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) send("done", { reply, title: prepared.title, conversationId, persisted, status: "completed", liveData: { kind: liveData.kind, provider: liveData.provider, fetchedAt: liveData.fetchedAt, cached: liveData.cached, freshness: liveData.freshness, sources: liveData.sources } });
          return res.writableEnded || res.destroyed ? undefined : res.end();
        }
        providerMessages = [...prepared.providerMessages, { role: "user", content: liveDataContext(liveData) }];
      }
      catch (error) {
        if (requestController.signal.aborted) throw error;
        const reason = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
        console.error(JSON.stringify({ event: "live_data_lookup_failed", kind: liveIntent.kind, reason }));
        const reply = "i couldn't verify the current information just now, so i won't guess. please try again shortly.";
        const persisted = await saveTurn(reply, null);
        if (!clientDisconnected && !res.writableEnded && !res.destroyed) send("done", { reply, title: prepared.title, conversationId, persisted, status: "completed", liveDataUnavailable: true });
        return res.writableEnded || res.destroyed ? undefined : res.end();
      }
    }
    if (!liveIntent && prepared.latestUserMessage && !wantsLocalSite(prepared.latestUserMessage.content) && !wantsToBuild(prepared.latestUserMessage.content) && !prepared.website && shouldRouteTools(prepared.latestUserMessage.content)) {
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
        const toolSite = toolResult.status === "completed" ? await localSiteFor(toolResult.message) : {};
        if (!clientDisconnected && !res.writableEnded && !res.destroyed) send("done", { ...toolSite, reply: toolResult.message, title: prepared.title, conversationId, status: toolResult.status, ...(toolModel ? { model: toolModel } : {}), toolCalls: toolResult.toolCalls, tools: toolResult.usedTools, backgroundJobIds: toolResult.backgroundJobIds, persisted, ...(toolResult.status === "approval_required" && toolResult.pendingCall ? { approval: { ...toolResult.pendingCall, workspaceId: workspace.id } } : {}) });
        return res.writableEnded || res.destroyed ? undefined : res.end();
      }
    }
    assistantId = clientAssistantId(req.body?.assistantMessageId); const initialMessages = [...persistedTurnMessages(req.body?.messages), { id: assistantId, role: "assistant", content: "", model: null, status: "pending" }]; const persisted = await dbSaveConversation({ keepTitle: true, id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: initialMessages }); if (!persisted) throw new Error("persistent chat storage unavailable"); await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId: workspace.id, status: "streaming" });
    // Once the reply is being written, a dropped connection does NOT stop it: the reply is finished and saved, and the
    // website picks it up when it reconnects. Only an explicit Stop (POST /stream/cancel) ends generation early.
    let disconnected = clientDisconnected; let streamedContent = ""; const generation = new AbortController(); if (requestController.signal.aborted) generation.abort(requestController.signal.reason); activeGenerations.set(assistantId, { userId: req.user!.id, controller: generation }); const onClose = () => { disconnected = true; clientDisconnected = true; }; res.once("close", onClose); if (res.destroyed) onClose();
    const emit = (token: string) => { streamedContent += token; if (!disconnected && !res.writableEnded) send("token", { token }); };
    try {
      let result: { content: string; model: string; provider?: string; fallbacks?: number; finishReason?: "stop" | "length" | "interrupted" };
      try {
        // Deterministic calculator UI prevents the model from inventing button wiring or arithmetic behavior.
        if (isCalculatorBuildRequest(prepared.latestUserMessage?.content ?? "")) {
          const content = calculatorCodeBlock();
          for (let offset = 0; offset < content.length; offset += 96) emit(content.slice(offset, offset + 96));
          result = { content, model: "jarvis-calculator-template", provider: "coding", finishReason: "stop" };
        } else {
          result = await runStream(providerMessages, emit, prepared.modelId, generation.signal);
        }
      }
      catch (error) {
        // Text already arrived and the user didn't press Stop: keep it and try to finish it, rather than losing it all.
        if (!streamedContent.trim() || generation.signal.aborted) throw error;
        result = { content: streamedContent, model: (error as { model?: string }).model ?? prepared.modelId ?? "unknown", finishReason: "interrupted" };
      }
      let content = result.content; let finishReason = result.finishReason ?? "stop"; let continuations = 0;
      while ((finishReason !== "stop" || hasOpenFence(content)) && continuations < MAX_CONTINUATIONS && !generation.signal.aborted) {
        continuations += 1;
        const piece = continuationEmitter(content, emit);
        try { const more = await runStream([...providerMessages, { role: "assistant", content }, { role: "user", content: continuePrompt(content) }], piece.onToken, result.model, generation.signal); content += piece.finish() || ""; finishReason = more.finishReason ?? "stop"; void more; }
        catch (error) { const added = piece.finish(); content += added; if (generation.signal.aborted) break; if (!added) { console.error(JSON.stringify({ event: "continuation_failed", error: error instanceof Error ? error.message.slice(0, 200) : "unknown" })); break; } finishReason = "interrupted"; }
      }
      const incomplete = finishReason !== "stop" || hasOpenFence(content);
      const finalStatus = generation.signal.aborted ? "cancelled" : incomplete ? "incomplete" : "completed";
      await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: finalStatus, content, model: result.model });
      // "…on localhost": save the website Jarvis just wrote and hand back its local address.
      const localSite = incomplete ? {} : await localSiteFor(content);
      if (disconnected || res.writableEnded) return; send("done", { ...localSite, reply: content, title: prepared.title, model: result.model, provider: result.provider, fallbacks: result.fallbacks, ...(incomplete ? { incomplete: true } : {}), ...(continuations ? { continued: continuations } : {}), ...(prepared.compacted ? { compacted: prepared.compacted } : {}), conversationId, persisted: true, status: finalStatus, ...(liveData ? { liveData: { kind: liveData.kind, provider: liveData.provider, fetchedAt: liveData.fetchedAt, cached: liveData.cached, freshness: liveData.freshness, sources: liveData.sources } } : {}) }); return res.end(); } catch (error) { await dbUpdateMessageStatus({ conversationId, messageId: assistantId!, userId: req.user!.id, workspaceId: workspace.id, status: generation.signal.aborted ? "cancelled" : streamedContent.trim() ? "incomplete" : "failed", content: streamedContent }).catch(() => false); throw error; } finally { res.off("close", onClose); activeGenerations.delete(assistantId!); }
  } catch (error) { console.error("STREAM ROUTE ERROR:", error); if (assistantId && workspaceId && !clientDisconnected) await dbUpdateMessageStatus({ conversationId, messageId: assistantId, userId: req.user!.id, workspaceId, status: "failed" }).catch(() => false); if (!clientDisconnected && !res.writableEnded && !res.destroyed) { const publicMessage = (error as { publicMessage?: unknown } | null)?.publicMessage; send("error", { message: typeof publicMessage === "string" ? publicMessage : "Jarvis hit a temporary problem and could not finish that reply. Please try again." }); res.end(); } }
});
export default router;