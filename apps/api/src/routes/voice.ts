import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { db, settings } from "@bobai/db";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { status, synthesize, transcribe } from "../services/voice.js";
import { prepareChat, runChat } from "../services/chatEngine.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { dbRecallRelevant, dbRemember, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { decideTools } from "../services/toolDecision.js";
import { runToolLoop } from "../services/toolLoop.js";

const router = Router();
const limit = createUserRateLimit(20, 60_000);
const decode = (value: unknown, maxBytes: number) => {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 16 || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(value)) throw new Error("invalid audio");
  const normalized = value.replace(/\s/g, "");
  const data = Buffer.from(normalized, "base64");
  const canonical = data.toString("base64");
  if (!data.length || data.length > maxBytes || canonical.replace(/=+$/, "") !== normalized.replace(/=+$/, "")) throw new Error("invalid audio");
  return data;
};
function relevantMemories(memories: Array<Record<string, unknown>> | null) {
  if (!memories?.length) return [];
  return memories.slice(0, 12).map((memory) => `${typeof memory.category === "string" ? memory.category : "memory"}: ${typeof memory.content === "string" ? memory.content : ""}`);
}
router.get("/status", async (_req, res) => res.json(await status()));

router.post("/turn", limit, async (req, res) => {
  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded && !res.destroyed) controller.abort(new Error("client disconnected")); };
  req.once("aborted", onDisconnect);
  res.once("close", onDisconnect);
  try {
    const supplied = req.body?.messages;
    if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length > 30 || supplied.some((item: unknown) => !item || typeof item !== "object" || !["user", "assistant"].includes((item as Record<string, unknown>).role as string) || typeof (item as Record<string, unknown>).content !== "string" || ((item as Record<string, unknown>).content as string).length > 8_000))) {
      return res.status(400).json({ error: "messages must contain up to 30 user/assistant turns with text under 8,000 characters each" });
    }
    if (req.body?.modelId !== undefined && (typeof req.body.modelId !== "string" || req.body.modelId.length > 160)) return res.status(400).json({ error: "invalid modelId" });

    const audio = decode(req.body?.audio, 25 * 1024 * 1024);
    const transcript = await transcribe(audio, req.body?.options);
    if (controller.signal.aborted || res.destroyed) return;
    const spokenText = typeof transcript?.text === "string" ? transcript.text.trim() : "";
    if (!spokenText) return res.status(422).json({ error: "no speech was recognized; try recording again" });
    if (spokenText.length > 20_000) return res.status(413).json({ error: "recognized speech is too long" });

    const selectedModelId = typeof req.body?.modelId === "string" ? req.body.modelId : "bob";
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const settingRows = await db.select({ key: settings.key, value: settings.value }).from(settings)
      .where(and(eq(settings.userId, req.user!.id), eq(settings.workspaceId, workspace.id))).limit(50);
    const getSetting = (key: string) => settingRows.find((row) => row.key === key)?.value;
    const memoryEnabled = req.body?.memoryEnabled !== false && getSetting("memoryEnabled") !== false;
    const messages = [...(Array.isArray(supplied) ? supplied : []), { role: "user", content: spokenText }];
    const memories = memoryEnabled ? await dbRecallRelevant(workspace.id, req.user!.id, spokenText, 12) : [];
    const prepared = await prepareChat({
      messages,
      modelId: selectedModelId,
      language: getSetting("language"),
      responseStyle: getSetting("responseStyle"),
      responseLength: getSetting("responseLength"),
      tone: getSetting("tone"),
      personality: getSetting("personality"),
      customInstructions: getSetting("customInstructions"),
      memoryContext: relevantMemories(memories),
    });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });

    if (prepared.memoryRequest && prepared.latestUserMessage) {
      if (!memoryEnabled) return res.json({ transcript: spokenText, reply: "memory is off, so i won't save that.", memoryStored: false, audio: null });
      if (isSensitiveMemory(prepared.latestUserMessage.content)) return res.json({ transcript: spokenText, reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", memoryStored: false, audio: null });
      const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() });
      if (!stored) return res.status(503).json({ error: "memory storage unavailable" });
      const speech = await synthesize("got it. i will remember that for future conversations.", req.body?.voiceOptions).catch(() => null);
      return res.json({ transcript: spokenText, reply: "got it. i will remember that for future conversations.", memoryStored: true, audio: speech?.audio ?? null, mimeType: speech?.mimeType ?? null, voice: speech ? { engine: speech.engine, model: speech.model, language: speech.language, offline: speech.offline } : null });
    }

    const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID();
    const loop = await runToolLoop(prepared.providerMessages, {
      userId: req.user!.id,
      workspaceId: workspace.id,
      approvalToken: typeof req.body?.approvalToken === "string" ? req.body.approvalToken : undefined,
      modelId: selectedModelId,
      mode: typeof req.body?.mode === "string" ? req.body.mode : undefined,
      signal: controller.signal,
    }, async (providerMessages) => decideTools(providerMessages as any, "bob"), async (providerMessages) => {
      const result = await runChat(providerMessages as any, selectedModelId, controller.signal);
      return { content: result.message.content };
    });
    if (controller.signal.aborted || res.destroyed) return;
    if (loop.status === "approval_required") return res.status(202).json({ transcript: spokenText, reply: loop.message, conversationId, toolStatus: loop.status, toolCalls: loop.toolCalls, tools: loop.usedTools, audio: null });
    if (loop.status !== "completed") return res.status(503).json({ error: loop.message, transcript: spokenText, conversationId, toolStatus: loop.status });

    const replyText = typeof loop.message === "string" ? loop.message.trim().slice(0, 6_000) : "";
    if (!replyText) return res.status(502).json({ error: "assistant returned an empty response" });
    const conversationMessages = [
      ...(Array.isArray(supplied) ? supplied : []).map((message: any) => ({
        id: typeof message?.id === "string" ? message.id : randomUUID(),
        role: message?.role === "assistant" ? "assistant" : "user",
        content: typeof message?.content === "string" ? message.content : "",
        model: typeof message?.model === "string" ? message.model : null,
        status: "completed",
      })),
      { id: randomUUID(), role: "user", content: spokenText, model: null, status: "completed" },
      { id: randomUUID(), role: "assistant", content: replyText, model: "bob", status: "completed" },
    ];
    const persisted = await dbSaveConversation({
      id: conversationId, userId: req.user!.id, workspaceId: workspace.id,
      title: prepared.title, messages: conversationMessages,
    }).catch(() => false);
    const speech = await synthesize(replyText, req.body?.voiceOptions).catch((error) => {
      if (process.env.NODE_ENV !== "production") console.error("voice synthesis failed", error);
      return null;
    });
    if (controller.signal.aborted || res.destroyed) return;
    return res.json({
      transcript: spokenText,
      reply: replyText,
      audio: speech?.audio ?? null,
      mimeType: speech?.mimeType ?? null,
      voice: speech ? { engine: speech.engine, model: speech.model, language: speech.language, offline: speech.offline } : null,
      voiceError: speech ? undefined : "speech synthesis is unavailable; the text reply is still available",
      model: selectedModelId,
      conversationId,
      persisted,
      toolStatus: loop.status,
      toolCalls: loop.toolCalls,
      tools: loop.usedTools,
      backgroundJobIds: loop.backgroundJobIds,
    });
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    const message = error instanceof Error ? error.message : "voice turn failed";
    if (message === "invalid audio") return res.status(400).json({ error: message });
    if (/messages must|messages cannot|message content|personality cannot/i.test(message)) return res.status(400).json({ error: message });
    if (process.env.NODE_ENV !== "production") console.error("local voice turn failed", error);
    return res.status(503).json({ error: "local voice conversation unavailable; check local Whisper.cpp, Ollama, and Piper readiness" });
  } finally {
    req.off("aborted", onDisconnect);
    res.off("close", onDisconnect);
  }
});

router.post("/transcribe", limit, async (req, res) => {
  try { return res.json(await transcribe(decode(req.body?.audio, 25 * 1024 * 1024), req.body?.options)); }
  catch (error) { const message = error instanceof Error ? error.message : "voice transcription unavailable"; return res.status(message === "invalid audio" ? 400 : 503).json({ error: message === "invalid audio" ? message : "local voice transcription unavailable" }); }
});
router.post("/synthesize", limit, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 20_000) return res.status(400).json({ error: "invalid text" });
  try { return res.json(await synthesize(text, req.body?.options)); }
  catch { return res.status(503).json({ error: "local speech synthesis unavailable" }); }
});
export default router;
