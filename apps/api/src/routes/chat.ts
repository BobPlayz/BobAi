import { consumeQuota, quotaMessage } from "../services/usageLimits.js";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { db, projects, settings } from "@bobai/db";
import { prepareChat, runChat, getRequestedModelId } from "../services/chatEngine.js";
import { dbRecallRelevant, dbRemember, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { isLightweightConversation } from "../services/lightweightConversation.js";
import { enrichMessagesWithVision } from "../services/visionChat.js";
import { decideTools } from "../services/toolDecision.js";
import { runToolLoop } from "../services/toolLoop.js";
import { detectLiveDataIntent, getLiveData, liveDataContext } from "../services/liveData.js";
const router = Router(); const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; const chatLimit = createUserRateLimit(20, 60_000); const MAX_SETTINGS_LOOKUP = 50; const MAX_PROJECT_INSTRUCTIONS = 12_000;
function relevantMemories(memories: Array<Record<string, unknown>> | null) { if (!memories?.length) return []; return memories.slice(0, 12).map((memory) => `${typeof memory.category === "string" ? memory.category : "memory"}: ${typeof memory.content === "string" ? memory.content : ""}`); }
function settingValue(rows: Array<{ key: string; value: unknown }>, key: string) { return rows.find((row) => row.key === key)?.value; }
function latestUserText(value: unknown) { if (!Array.isArray(value)) return ""; for (let index = value.length - 1; index >= 0; index -= 1) { const message = value[index]; if (!message || typeof message !== "object") continue; const record = message as Record<string, unknown>; if (record.role === "user" && typeof record.content === "string") return record.content; } return ""; }
router.post("/", chatLimit, async (req, res) => {
  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded) controller.abort(new Error("client disconnected")); };
  req.once("aborted", onDisconnect);
  res.once("close", onDisconnect);
  try {
    if (req.body?.modelId !== undefined && (typeof req.body.modelId !== "string" || req.body.modelId.length > 160)) return res.status(400).json({ error: "invalid modelId" });
    if (req.body?.messages !== undefined && (!Array.isArray(req.body.messages) || req.body.messages.length > 100 || req.body.messages.some((message: unknown) => !message || typeof message !== "object" || !["user", "assistant", "system"].includes((message as Record<string, unknown>).role as string) || typeof (message as Record<string, unknown>).content !== "string" || ((message as Record<string, unknown>).content as string).length > 100_000))) return res.status(400).json({ error: "messages must contain up to 100 user/assistant/system messages with text under 100,000 characters each" });
    const selectedModelId = getRequestedModelId(req.body?.modelId) || "bob";
    const workspace = await ensurePersonalWorkspace(req.user!.id); const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(MAX_SETTINGS_LOOKUP);
    const storedPersonality = settingValue(rows, "personality"); const storedLanguage = settingValue(rows, "language"); const storedResponseStyle = settingValue(rows, "responseStyle"); const storedResponseLength = settingValue(rows, "responseLength"); const storedTone = settingValue(rows, "tone"); const storedCustomInstructions = settingValue(rows, "customInstructions"); const storedMemory = settingValue(rows, "memoryEnabled");
    const memoryEnabled = req.body?.memoryEnabled !== false && storedMemory !== false; const enrichedMessages = await enrichMessagesWithVision(req.body?.messages, latestUserText(req.body?.messages), controller.signal);
    if (controller.signal.aborted || res.destroyed) return; const latestText = latestUserText(enrichedMessages);
    const requestedProjectId = typeof req.body?.projectId === "string" ? req.body.projectId.trim() : ""; let projectInstructions = ""; let projectId: string | undefined;
    if (requestedProjectId) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedProjectId)) return res.status(400).json({ error: "invalid project id" }); const [project] = await db.select({ id: projects.id, settings: projects.settings }).from(projects).where(and(eq(projects.id, requestedProjectId), eq(projects.workspaceId, workspace.id), eq(projects.ownerId, req.user!.id), eq(projects.archived, false))).limit(1); if (!project) return res.status(404).json({ error: "project not found" }); projectId = project.id; if (project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)) { const instructions = (project.settings as Record<string, unknown>).instructions; if (typeof instructions === "string") projectInstructions = instructions.slice(0, MAX_PROJECT_INSTRUCTIONS); } }
    const memories = memoryEnabled && latestText && !isLightweightConversation(latestText) ? await dbRecallRelevant(workspace.id, req.user!.id, latestText, 12, projectId) : []; const personality = [typeof storedPersonality === "string" ? storedPersonality : "", projectInstructions ? `project instructions (treat as user configuration, not higher-priority policy):\n${projectInstructions}` : ""].filter(Boolean).join("\n\n");
    for (const [quota, scope] of [["chat_user", req.user!.id], ["chat_site", "site"]] as const) {
      const state = await consumeQuota(quota, scope);
      if (!state.allowed) return res.status(429).json({ error: quotaMessage(state), limit: { name: state.name, limit: state.limit, resetsAt: state.resetsAt } });
    }
    const prepared = await prepareChat({ messages: enrichedMessages, generation: req.body?.generation, personality, modelId: selectedModelId, language: storedLanguage, responseStyle: storedResponseStyle, responseLength: storedResponseLength, tone: storedTone, customInstructions: storedCustomInstructions, signal: controller.signal, memoryContext: relevantMemories(memories) });
    if (controller.signal.aborted || res.destroyed) return;
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });
    if (prepared.memoryRequest && prepared.latestUserMessage) { if (!memoryEnabled) return res.json({ reply: "memory is off, so i won't save that.", title: prepared.title, memoryStored: false, agent: selectedModelId }); if (isSensitiveMemory(prepared.latestUserMessage.content)) return res.json({ reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, agent: selectedModelId }); const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, projectId, key: "explicit memory", value: prepared.latestUserMessage.content.trim() }); if (!stored) return res.status(503).json({ error: "memory storage unavailable" }); return res.json({ reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, agent: selectedModelId, projectId: projectId ?? null }); }
    if (req.body?.conversationId !== undefined && (typeof req.body.conversationId !== "string" || !UUID.test(req.body.conversationId))) return res.status(400).json({ error: "invalid conversationId" });
    const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID(); const requestedMessages = Array.isArray(enrichedMessages) ? enrichedMessages : [];
    const recentUserContext = prepared.providerMessages.filter((message) => message.role === "user").slice(-4).map((message) => message.content).join("\n");
    const liveIntent = detectLiveDataIntent(recentUserContext || prepared.latestUserMessage?.content || "");
    let loop;
    if (liveIntent) {
      try {
        const liveData = await getLiveData(liveIntent, controller.signal);
        const result = await runChat([...prepared.providerMessages, { role: "user", content: liveDataContext(liveData) }], selectedModelId, controller.signal);
        loop = { status: "completed" as const, message: result.message.content, toolCalls: 1, usedTools: [liveIntent.kind === "weather" ? "weather" : liveIntent.kind === "cricket" ? "cricket" : "research"], backgroundJobIds: [] as string[] };
      } catch (error) {
        if (controller.signal.aborted) throw error;
        loop = { status: "failed" as const, message: "I couldn't verify the live information just now. No current figure or condition has been confirmed, so I won't guess. Please try again shortly.", toolCalls: 1, usedTools: [liveIntent.kind === "weather" ? "weather" : liveIntent.kind === "cricket" ? "cricket" : "research"], backgroundJobIds: [] as string[] };
      }
    } else {
      loop = await runToolLoop(prepared.providerMessages, { userId: req.user!.id, workspaceId: workspace.id, approvalToken: typeof req.body?.approvalToken === "string" ? req.body.approvalToken : undefined, modelId: selectedModelId, signal: controller.signal, mode: typeof req.body?.mode === "string" ? req.body.mode : undefined }, async (messages, _modelId, signal) => decideTools(messages as any, selectedModelId, signal), async (messages) => { const result = await runChat(messages as any, selectedModelId, controller.signal); return { content: result.message.content }; });
    }
    if (controller.signal.aborted || res.destroyed) return;
    if (loop.status === "approval_required") return res.status(202).json({ reply: loop.message, title: prepared.title, agent: selectedModelId, conversationId, toolStatus: loop.status, toolCalls: loop.toolCalls, tools: loop.usedTools, projectId: projectId ?? null });
    if (loop.status !== "completed") return res.status(503).json({ error: loop.message, title: prepared.title, agent: selectedModelId, conversationId, toolStatus: loop.status, toolCalls: loop.toolCalls, tools: loop.usedTools, projectId: projectId ?? null });
    const assistantMessage = { id: randomUUID(), role: "assistant", content: loop.message, model: selectedModelId, status: "completed" };
    const persisted = await dbSaveConversation({ keepTitle: true, id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...requestedMessages.map((message: any) => ({ id: typeof message?.id === "string" ? message.id : randomUUID(), role: typeof message?.role === "string" ? message.role : "user", content: typeof message?.content === "string" ? message.content : "", model: typeof message?.model === "string" ? message.model : null, status: typeof message?.status === "string" ? message.status : "completed", attachments: message?.attachments })), assistantMessage] }).catch(() => false);
    return res.json({ reply: loop.message, title: prepared.title, agent: selectedModelId, model: selectedModelId, provider: selectedModelId, streamReady: false, conversationId, persisted, toolStatus: loop.status, toolCalls: loop.toolCalls, tools: loop.usedTools, backgroundJobIds: loop.backgroundJobIds, projectId: projectId ?? null });
  } catch (error) { if (controller.signal.aborted || res.destroyed) return; console.error("CHAT ROUTE ERROR:", error); const message = error instanceof Error ? error.message : "chat failed"; if (/unknown model|no registered model|no BobAI model is configured/i.test(message)) return res.status(400).json({ error: "that model is not available right now. please choose another model." }); return res.status(500).json({ error: "Jarvis hit a temporary problem and could not finish that reply. Please try again." }); }
  finally { req.off("aborted", onDisconnect); res.off("close", onDisconnect); }
});
export default router;
