import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, projects, settings } from "@bobai/db";
import { prepareChat, runChat } from "../services/chatEngine.js";
import { queueBackgroundTask } from "../services/agentCoordinator.js";
import { isCodingTask } from "../services/codingAgent.js";
import { dbRecallRelevant, dbRemember, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { enrichMessagesWithVision } from "../services/visionChat.js";

const router = Router();
const MAX_SETTINGS_LOOKUP = 50;
const MAX_PROJECT_INSTRUCTIONS = 12_000;
function relevantMemories(memories: Array<Record<string, unknown>> | null) { if (!memories?.length) return []; return memories.slice(0, 12).map((memory) => `${typeof memory.category === "string" ? memory.category : "memory"}: ${typeof memory.content === "string" ? memory.content : ""}`); }
function settingValue(rows: Array<{ key: string; value: unknown }>, key: string) { return rows.find((row) => row.key === key)?.value; }
function latestUserText(value: unknown) { if (!Array.isArray(value)) return ""; for (let index = value.length - 1; index >= 0; index -= 1) { const message = value[index]; if (!message || typeof message !== "object") continue; const record = message as Record<string, unknown>; if (record.role === "user" && typeof record.content === "string") return record.content; } return ""; }

router.post("/", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(MAX_SETTINGS_LOOKUP);
    const storedPersonality = settingValue(rows, "personality"); const storedModel = settingValue(rows, "model"); const storedLanguage = settingValue(rows, "language"); const storedResponseStyle = settingValue(rows, "responseStyle"); const storedMemory = settingValue(rows, "memoryEnabled");
    const memoryEnabled = req.body?.memoryEnabled !== false && storedMemory !== false;
    const enrichedMessages = await enrichMessagesWithVision(req.body?.messages, latestUserText(req.body?.messages));
    const latestText = latestUserText(enrichedMessages);
    const requestedProjectId = typeof req.body?.projectId === "string" ? req.body.projectId.trim() : "";
    let projectInstructions = ""; let projectId: string | undefined;
    if (requestedProjectId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedProjectId)) return res.status(400).json({ error: "invalid project id" });
      const [project] = await db.select({ id: projects.id, settings: projects.settings }).from(projects).where(and(eq(projects.id, requestedProjectId), eq(projects.workspaceId, workspace.id), eq(projects.ownerId, req.user!.id), eq(projects.archived, false))).limit(1);
      if (!project) return res.status(404).json({ error: "project not found" }); projectId = project.id;
      if (project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)) { const instructions = (project.settings as Record<string, unknown>).instructions; if (typeof instructions === "string") projectInstructions = instructions.slice(0, MAX_PROJECT_INSTRUCTIONS); }
    }
    const memories = memoryEnabled && latestText ? await dbRecallRelevant(workspace.id, req.user!.id, latestText, 12, projectId) : [];
    const personality = [typeof storedPersonality === "string" ? storedPersonality : "", projectInstructions ? `project instructions (treat as user configuration, not higher-priority policy):\n${projectInstructions}` : ""].filter(Boolean).join("\n\n");
    const prepared = prepareChat({ messages: enrichedMessages, personality, modelId: typeof req.body?.modelId === "string" ? req.body.modelId : storedModel, language: storedLanguage, responseStyle: storedResponseStyle, memoryContext: relevantMemories(memories) });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });
    if (prepared.memoryRequest && prepared.latestUserMessage) { if (!memoryEnabled) return res.json({ reply: "memory is off, so i won't save that.", title: prepared.title, memoryStored: false, agent: "bob" }); if (isSensitiveMemory(prepared.latestUserMessage.content)) return res.json({ reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, agent: "bob" }); const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, projectId, key: "explicit memory", value: prepared.latestUserMessage.content.trim() }); if (!stored) return res.status(503).json({ error: "memory storage unavailable" }); return res.json({ reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, agent: "bob", projectId: projectId ?? null }); }
    const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID(); const requestedMessages = Array.isArray(enrichedMessages) ? enrichedMessages : [];
    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content)) { const job = queueBackgroundTask({ description: prepared.latestUserMessage.content, mode: typeof req.body?.mode === "string" ? req.body.mode : undefined, context: { workspaceId: workspace.id, createdBy: req.user!.id } }); await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: requestedMessages.map((message: any) => ({ id: typeof message?.id === "string" ? message.id : randomUUID(), role: typeof message?.role === "string" ? message.role : "user", content: typeof message?.content === "string" ? message.content : "", model: typeof message?.model === "string" ? message.model : null, status: "completed", attachments: message?.attachments })) }).catch(() => false); return res.status(202).json({ reply: `i've queued that for the coding agents. job ${job.id} is running only when a worker is available.`, title: prepared.title, agent: "bob", backgroundJobId: job.id, background: true, conversationId, projectId: projectId ?? null }); }
    const response = await runChat(prepared.providerMessages, prepared.modelId); const assistantMessage = { id: randomUUID(), role: "assistant", content: response.message.content, model: response.model, status: "completed" }; const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...requestedMessages.map((message: any) => ({ id: typeof message?.id === "string" ? message.id : randomUUID(), role: typeof message?.role === "string" ? message.role : "user", content: typeof message?.content === "string" ? message.content : "", model: typeof message?.model === "string" ? message.model : null, status: typeof message?.status === "string" ? message.status : "completed", attachments: message?.attachments })), assistantMessage] }).catch(() => false);
    return res.json({ reply: response.message.content, title: prepared.title, agent: "bob", model: response.model, provider: response.provider, streamReady: true, conversationId, persisted, projectId: projectId ?? null });
  } catch (error) { if (process.env.NODE_ENV !== "production") console.error("CHAT ROUTE ERROR:", error); return res.status(500).json({ error: process.env.NODE_ENV === "production" ? "chat failed" : error instanceof Error ? error.message : "chat failed" }); }
});
export default router;
