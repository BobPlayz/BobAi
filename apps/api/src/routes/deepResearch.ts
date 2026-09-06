import { Router } from "express";
import { deepResearch } from "../services/deepResearch.js";

const router = Router();
const buckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 4;

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

router.post("/", async (req, res) => {
  if (limited(req.user!.id)) return res.status(429).json({ error: "too many deep research requests", retryAfterSeconds: 60 });
  try {
    const result = await deepResearch(req.body?.query);
    return res.json({ ...result, mode: "deep-research" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("deep research failed", error);
    return res.status(503).json({ error: "deep research unavailable" });
  }
});

export default router;
