import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { synthesize, transcribe } from "../services/voice.js";

const router = Router();
router.use(requireAuth);
const limit = createUserRateLimit(20, 60_000);

router.post("/transcribe", limit, async (req, res) => {
  const encoded = typeof req.body?.audio === "string" ? req.body.audio : "";
  if (!/^[A-Za-z0-9+/\s]*={0,2}$/.test(encoded) || encoded.length > 34 * 1024 * 1024) return res.status(400).json({ error: "invalid audio" });
  const input = Buffer.from(encoded, "base64");
  if (!input.length || input.length > 25 * 1024 * 1024) return res.status(400).json({ error: "invalid audio" });
  try {
    return res.json(await transcribe(input, req.body?.options));
  } catch {
    return res.status(503).json({ error: "voice transcription unavailable" });
  }
});

router.post("/synthesize", limit, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 20_000) return res.status(400).json({ error: "invalid text" });
  try {
    return res.json(await synthesize(text, req.body?.options));
  } catch {
    return res.status(503).json({ error: "voice synthesis unavailable" });
  }
});

export default router;
