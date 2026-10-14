import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { status, synthesize, transcribe } from "../services/voice.js";
import { prepareChat, runChat } from "../services/chatEngine.js";
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
    const messages = [...(Array.isArray(supplied) ? supplied : []), { role: "user", content: spokenText }];
    const prepared = await prepareChat({ messages, modelId: typeof req.body?.modelId === "string" ? req.body.modelId : undefined });
    if (prepared.validationError) return res.status(400).json({ error: prepared.validationError });
    const reply = await runChat(prepared.providerMessages, prepared.modelId, controller.signal);
    if (controller.signal.aborted || res.destroyed) return;
    const text = typeof reply?.message?.content === "string" ? reply.message.content.trim().slice(0, 6_000) : "";
    if (!text) return res.status(502).json({ error: "local chat returned an empty response" });
    const speech = await synthesize(text, req.body?.voiceOptions);
    if (controller.signal.aborted || res.destroyed) return;
    return res.json({ transcript: spokenText, reply: text, audio: speech.audio, mimeType: speech.mimeType, voice: { engine: speech.engine, model: speech.model, language: speech.language, offline: speech.offline }, model: reply.model ?? prepared.modelId ?? null });
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
