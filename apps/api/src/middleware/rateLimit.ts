import type { NextFunction, Request, Response } from "express";

type Bucket = { startedAt: number; count: number };

const buckets = new Map<string, Bucket>();
const windowMs = Math.max(1_000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000);
const maxRequests = Math.max(1, Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120);
const maxBuckets = 10_000;

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= windowMs) buckets.delete(key);
  }
}

const cleanupTimer = setInterval(() => pruneExpired(Date.now()), windowMs);
cleanupTimer.unref();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    if (buckets.size >= maxBuckets) pruneExpired(now);
    if (buckets.size >= maxBuckets) return res.status(429).json({ error: "rate limit exceeded" });
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }

  if (++current.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1_000));
    res.setHeader("retry-after", retryAfter);
    return res.status(429).json({ error: "rate limit exceeded", retryAfter });
  }

  return next();
}
