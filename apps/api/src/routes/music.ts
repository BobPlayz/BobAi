import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { analyzeMusic, editMusic, generateMusic } from "../services/music.js";

const router = Router();
router.use(requireAuth);
const max = { prompt: 4_000, lyrics: 20_000 };

router.post("/generate", async (req, res) => {
  const body = req.body ?? {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > max.prompt) return res.status(400).json({ error: "invalid prompt" });
  const duration = body.durationSeconds == null ? undefined : Number(body.durationSeconds);
  const bpm = body.bpm == null ? undefined : Number(body.bpm);
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 10 || duration > 600)) return res.status(400).json({ error: "invalid duration" });
  if (bpm !== undefined && (!Number.isInteger(bpm) || bpm < 30 || bpm > 300)) return res.status(400).json({ error: "invalid bpm" });
  try {
    return res.json(await generateMusic({
      prompt,
      lyrics: typeof body.lyrics === "string" ? body.lyrics.slice(0, max.lyrics) : undefined,
      durationSeconds: duration,
      instrumental: Boolean(body.instrumental),
      genre: typeof body.genre === "string" ? body.genre.slice(0, 200) : undefined,
      mood: typeof body.mood === "string" ? body.mood.slice(0, 200) : undefined,
      bpm,
      key: typeof body.key === "string" ? body.key.slice(0, 30) : undefined,
      seed: Number.isInteger(body.seed) ? body.seed : undefined,
      referenceAudio: typeof body.referenceAudio === "string" ? body.referenceAudio : undefined
    }));
  } catch {
    return res.status(503).json({ error: "music generation unavailable" });
  }
});

router.post("/edit", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.audio !== "string" || !body.audio || typeof body.prompt !== "string" || !body.prompt.trim()) return res.status(400).json({ error: "audio and prompt required" });
  try {
    return res.json(await editMusic({ audio: body.audio, prompt: body.prompt.trim().slice(0, max.prompt), lyrics: typeof body.lyrics === "string" ? body.lyrics.slice(0, max.lyrics) : undefined }));
  } catch {
    return res.status(503).json({ error: "music editing unavailable" });
  }
});

router.post("/analyze", async (req, res) => {
  if (typeof req.body?.audio !== "string" || !req.body.audio) return res.status(400).json({ error: "audio required" });
  try {
    return res.json(await analyzeMusic(req.body.audio));
  } catch {
    return res.status(503).json({ error: "music analysis unavailable" });
  }
});

export default router;
