import { Router } from "express";
import { webSearch } from "../services/research.js";

const router = Router();
const buckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
function limited(userId: string) {
  const now = Date.now();
  const current = buckets.get(userId);
  if (!current || now - current.startedAt >= WINDOW_MS) { buckets.set(userId, { startedAt: now, count: 1 }); return false; }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}
const cleanup = setInterval(() => { const cutoff = Date.now() - WINDOW_MS; for (const [key, bucket] of buckets) if (bucket.startedAt < cutoff) buckets.delete(key); }, WINDOW_MS);
cleanup.unref();

router.post("/search", async (req, res) => {
  if (limited(req.user!.id)) return res.status(429).json({ error: "too many research requests", retryAfterSeconds: 60 });
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const options = req.body?.options && typeof req.body.options === "object" && !Array.isArray(req.body.options) ? req.body.options as Record<string, unknown> : {};
  try { return res.json(await webSearch(query, options)); }
  catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : "web search unavailable" }); }
});

export default router;
