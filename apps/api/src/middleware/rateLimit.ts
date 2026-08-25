import type { NextFunction, Request, Response } from "express";

const buckets = new Map<string, { startedAt: number; count: number }>();
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }

  current.count += 1;
  if (current.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
    res.setHeader("retry-after", retryAfter);
    return res.status(429).json({ error: "rate limit exceeded", retryAfter });
  }

  return next();
}
