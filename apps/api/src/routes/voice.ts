import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { synthesize, transcribe } from "../services/voice.js";

const router = Router();
router.use(requireAuth);

router.post("/transcribe", async (req, res) => {
  const input = Buffer.from(String(req.body?.audio ?? ""), "base64");
  if (!input.length || input.length > 25 * 1024 * 1024) return res.status(400).json({ error: "invalid audio" });
  try {
    return res.json(await transcribe(input, req.body?.options));
  } catch {
    return res.status(503).json({ error: "voice transcription unavailable" });
  }
});

router.post("/synthesize", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 20_000) return res.status(400).json({ error: "invalid text" });
  try {
    return res.json(await synthesize(text, req.body?.options));
  } catch {
    return res.status(503).json({ error: "voice synthesis unavailable" });
  }
});

export default router;
