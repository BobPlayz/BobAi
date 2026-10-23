import { sql } from "drizzle-orm";
import { db } from "@bobai/db";

/**
 * Usage limits that keep Jarvis inside the free allowances of the services it uses. Counters live in the shared
 * rate_limit_buckets table so every server instance sees the same numbers. Defaults sit safely below each free tier
 * (October 2026) and every limit can be changed with its environment variable; 0 means unlimited.
 *
 * - chat per user / whole site: protects the Ollama Cloud free allowance (Ollama publishes no fixed number)
 * - email: Gmail allows about 500 a day; Resend's free plan 100 a day
 * - cricket feed: CricketData.org free plan, 100 calls a day
 * - Brave Search: about $5 of free credit a month, roughly 1,000 searches
 */
export type QuotaName = "chat_user" | "chat_site" | "email" | "cricket_feed" | "brave_search";
type QuotaSpec = { env: string; defaultLimit: () => number; period: "day" | "month" };

const SPECS: Record<QuotaName, QuotaSpec> = {
  chat_user: { env: "BOBAI_LIMIT_CHAT_PER_USER_PER_DAY", defaultLimit: () => 60, period: "day" },
  chat_site: { env: "BOBAI_LIMIT_CHAT_PER_DAY", defaultLimit: () => 600, period: "day" },
  email: { env: "BOBAI_LIMIT_EMAILS_PER_DAY", defaultLimit: () => (process.env.BOBAI_EMAIL_PROVIDER?.trim().toLowerCase() === "smtp" || !process.env.RESEND_API_KEY ? 450 : 90), period: "day" },
  cricket_feed: { env: "BOBAI_LIMIT_CRICKET_CALLS_PER_DAY", defaultLimit: () => 95, period: "day" },
  brave_search: { env: "BOBAI_LIMIT_BRAVE_SEARCHES_PER_MONTH", defaultLimit: () => 900, period: "month" },
};

export type QuotaState = { name: QuotaName; used: number; limit: number; allowed: boolean; resetsAt: string };

export function quotaLimit(name: QuotaName) {
  const raw = process.env[SPECS[name].env]?.trim();
  const value = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : SPECS[name].defaultLimit();
}

/** Current period label and when it ends (UTC days; calendar months). */
export function quotaPeriod(name: QuotaName, now = new Date()) {
  if (SPECS[name].period === "month") {
    return { label: now.toISOString().slice(0, 7), endsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
  }
  return { label: now.toISOString().slice(0, 10), endsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) };
}

function bucketKey(name: QuotaName, scope: string, label: string) { return `quota:${name}:${scope}:${label}`.slice(0, 255); }

/**
 * Counts one use and says whether it was within the limit. A database problem allows the use (never block sign-in or
 * chat because a counter is unavailable) and is logged.
 */
export async function consumeQuota(name: QuotaName, scope = "site", now = new Date()): Promise<QuotaState> {
  const limit = quotaLimit(name);
  const { label, endsAt } = quotaPeriod(name, now);
  if (limit === 0) return { name, used: 0, limit, allowed: true, resetsAt: endsAt.toISOString() };
  try {
    const key = bucketKey(name, scope, label);
    const rows = await db.execute(sql`INSERT INTO rate_limit_buckets (bucket_key, window_start, count, expires_at) VALUES (${key}, ${now.toISOString()}, 1, ${endsAt.toISOString()}) ON CONFLICT (bucket_key) DO UPDATE SET count = rate_limit_buckets.count + 1 RETURNING count`);
    const used = Number((rows[0] as { count?: number } | undefined)?.count ?? 1);
    return { name, used, limit, allowed: used <= limit, resetsAt: endsAt.toISOString() };
  } catch (error) {
    console.error(JSON.stringify({ event: "quota_check_failed", quota: name, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return { name, used: 0, limit, allowed: true, resetsAt: endsAt.toISOString() };
  }
}

/** How much of a quota is used, without counting a use. */
export async function peekQuota(name: QuotaName, scope = "site", now = new Date()): Promise<QuotaState> {
  const limit = quotaLimit(name);
  const { label, endsAt } = quotaPeriod(name, now);
  let used = 0;
  try {
    const rows = await db.execute(sql`SELECT count FROM rate_limit_buckets WHERE bucket_key = ${bucketKey(name, scope, label)}`);
    used = Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
  } catch { /* report zero when the counter is unavailable */ }
  return { name, used, limit, allowed: limit === 0 || used < limit, resetsAt: endsAt.toISOString() };
}

/** A friendly message for a used-up chat quota. */
export function quotaMessage(state: QuotaState) {
  const time = new Date(state.resetsAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "UTC" });
  return state.name === "chat_user"
    ? `you've used all ${state.limit} of today's messages. they reset at ${time} UTC.`
    : `jarvis has hit its daily message limit for everyone (to stay inside its free AI plan). it resets at ${time} UTC.`;
}
