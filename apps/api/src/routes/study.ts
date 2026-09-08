import { Router } from "express";
import { createStudyPack } from "../services/studyMode.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const limit = createUserRateLimit(10, 60_000);

router.post("/pack", limit, async (req, res) => {
  try {
    const pack = await createStudyPack({ source: req.body?.source, topic: req.body?.topic, difficulty: req.body?.difficulty });
    return res.json({ ...pack, mode: "study" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("study mode failed", error);
    const message = error instanceof Error ? error.message : "study generation unavailable";
    if (/source|topic|difficulty|too long|invalid/i.test(message)) return res.status(400).json({ error: message });
    return res.status(503).json({ error: "study generation unavailable" });
  }
});

export default router;
