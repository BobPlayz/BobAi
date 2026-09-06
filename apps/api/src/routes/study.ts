import { Router } from "express";
import { createStudyPack } from "../services/studyMode.js";

const router = Router();
const buckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function limited(userId: string) {
  const now = Date.now();
  const current = buckets.get(userId);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

const cleanup = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, bucket] of buckets) if (bucket.startedAt < cutoff) buckets.delete(key);
}, WINDOW_MS);
cleanup.unref();

router.post("/pack", async (req, res) => {
  if (limited(req.user!.id)) return res.status(429).json({ error: "too many study requests", retryAfterSeconds: 60 });
  try {
    const pack = await createStudyPack({ source: req.body?.source, topic: req.body?.topic, difficulty: req.body?.difficulty });
    return res.json({ ...pack, mode: "study" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("study mode failed", error);
    return res.status(503).json({ error: "study generation unavailable" });
  }
});

export default router;
