import { sql } from "drizzle-orm";
import { db } from "@bobai/db";

export async function checkDistributedRateLimit(key: string, maxRequests: number, windowMs: number) {
  const safeKey = key.slice(0, 255);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const rows = await db.execute(sql`INSERT INTO rate_limit_buckets (bucket_key, window_start, count, expires_at) VALUES (${safeKey}, ${windowStart}, 1, ${expiresAt}) ON CONFLICT (bucket_key) DO UPDATE SET count = CASE WHEN rate_limit_buckets.window_start = ${windowStart} THEN rate_limit_buckets.count + 1 ELSE 1 END, window_start = ${windowStart}, expires_at = ${expiresAt} RETURNING count, expires_at`);
  const row = rows[0] as { count?: number; expires_at?: Date | string } | undefined;
  const count = Number(row?.count || 0);
  const expires = row?.expires_at instanceof Date ? row.expires_at.getTime() : Date.parse(String(row?.expires_at || expiresAt.toISOString()));
  return { allowed: count <= maxRequests, retryAfter: Math.max(1, Math.ceil((expires - now.getTime()) / 1000)) };
}
export async function cleanupDistributedRateLimits(now = new Date()) { const rows = await db.execute(sql`DELETE FROM rate_limit_buckets WHERE expires_at <= ${now} RETURNING bucket_key`); return rows.length; }
