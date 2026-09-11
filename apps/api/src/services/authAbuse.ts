type AbuseRecord = { failures: number; blockedUntil: number; lastFailureAt: number };

const records = new Map<string, AbuseRecord>();
const WINDOW_MS = 30 * 60_000;
const MAX_RECORDS = 25_000;
const BASE_BLOCK_MS = 2_000;
const MAX_BLOCK_MS = 15 * 60_000;

function prune(now = Date.now()) {
  for (const [key, record] of records) if (record.lastFailureAt + WINDOW_MS < now && record.blockedUntil < now) records.delete(key);
  if (records.size <= MAX_RECORDS) return;
  const oldest = [...records.entries()].sort((a, b) => a[1].lastFailureAt - b[1].lastFailureAt).slice(0, records.size - MAX_RECORDS);
  for (const [key] of oldest) records.delete(key);
}

setInterval(() => prune(), WINDOW_MS).unref();

export function authAbuseKey(ip: string | undefined, identifier: string) {
  const safeIp = (ip || "unknown").slice(0, 100);
  const safeIdentifier = identifier.trim().toLowerCase().slice(0, 254);
  return `${safeIp}:${safeIdentifier}`;
}

export function checkAuthAbuse(key: string) {
  const now = Date.now();
  const record = records.get(key);
  if (!record) return { blocked: false, retryAfterSeconds: 0 };
  if (record.blockedUntil <= now) return { blocked: false, retryAfterSeconds: 0 };
  return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((record.blockedUntil - now) / 1000)) };
}

export function recordAuthFailure(key: string) {
  const now = Date.now();
  prune(now);
  const current = records.get(key);
  const failures = current && current.lastFailureAt + WINDOW_MS >= now ? current.failures + 1 : 1;
  const blockedUntil = failures >= 3 ? now + Math.min(MAX_BLOCK_MS, BASE_BLOCK_MS * 2 ** Math.min(12, failures - 3)) : 0;
  records.set(key, { failures, blockedUntil, lastFailureAt: now });
  return Math.max(0, Math.ceil((blockedUntil - now) / 1000));
}

export function clearAuthFailures(key: string) {
  records.delete(key);
}
