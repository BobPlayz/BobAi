import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { status, synthesize, transcribe } from "../services/voice.js";
const router = Router();
const limit = createUserRateLimit(20, 60_000);
const decode = (value: unknown, maxBytes: number) => {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 16 || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(value)) throw new Error("invalid audio");
  const data = Buffer.from(value, "base64");
  if (!data.length || data.length > maxBytes) throw new Error("invalid audio");
  return data;
};
router.get("/status", async (_req, res) => res.json(await status()));
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
