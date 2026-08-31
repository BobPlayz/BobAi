import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@bobai/db";
import { requireAuth } from "../middleware/auth.js";
import { requestPasswordReset, resetPassword } from "../services/passwordReset.js";
import { listSessions, revokeAllSessions, revokeSession } from "../services/sessionManager.js";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const password = (value: unknown): value is string => typeof value === "string" && value.length >= 12 && value.length <= 128;
const resetBuckets = new Map<string, { startedAt: number; count: number }>();
const RESET_WINDOW_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 10;
function limited(req: { ip?: string }, key: string) { const now = Date.now(); const bucketKey = `${req.ip || "unknown"}:${key}`; const current = resetBuckets.get(bucketKey); if (!current || now - current.startedAt >= RESET_WINDOW_MS) { resetBuckets.set(bucketKey, { startedAt: now, count: 1 }); return false; } current.count += 1; return current.count > RESET_MAX_ATTEMPTS; }
function cleanupResetBuckets() { const cutoff = Date.now() - RESET_WINDOW_MS; for (const [key, bucket] of resetBuckets) if (bucket.startedAt < cutoff) resetBuckets.delete(key); }
setInterval(cleanupResetBuckets, RESET_WINDOW_MS).unref();

router.post("/password-reset/request", async (req, res) => {
  const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email.test(address)) return res.status(400).json({ error: "invalid email" });
  if (limited(req, `request:${address.slice(0, 254)}`)) return res.status(429).json({ error: "too many password reset requests", retryAfterSeconds: 900 });
  try { const resetToken = await requestPasswordReset(address); return res.status(202).json({ message: "if the account exists, password reset instructions have been created", ...(process.env.NODE_ENV === "development" && resetToken ? { resetToken } : {}) }); }
  catch { return res.status(503).json({ error: "password reset service unavailable" }); }
});

router.post("/password-reset/confirm", async (req, res) => {
  const { token, password: nextPassword } = req.body ?? {};
  if (typeof token !== "string" || token.length < 32 || !password(nextPassword)) return res.status(400).json({ error: "invalid reset request" });
  if (limited(req, "confirm")) return res.status(429).json({ error: "too many password reset attempts", retryAfterSeconds: 900 });
  try { if (!await resetPassword(token, nextPassword)) return res.status(400).json({ error: "invalid or expired reset token" }); return res.status(204).send(); }
  catch { return res.status(503).json({ error: "password reset service unavailable" }); }
});

router.use(requireAuth);
router.get("/me", async (req, res) => { const [user] = await db.select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, req.user!.id)).limit(1); return user ? res.json(user) : res.status(404).json({ error: "user not found" }); });
router.get("/export", async (req, res) => { const [user] = await db.select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users).where(eq(users.id, req.user!.id)).limit(1); if (!user) return res.status(404).json({ error: "user not found" }); return res.json({ exportedAt: new Date().toISOString(), user, sessions: await listSessions(req.user!.id) }); });
router.get("/sessions", async (req, res) => res.json({ sessions: await listSessions(req.user!.id) }));
router.delete("/sessions/:id", async (req, res) => res.status(await revokeSession(req.user!.id, req.params.id as string) ? 204 : 404).send());
router.delete("/sessions", async (req, res) => { await revokeAllSessions(req.user!.id); return res.status(204).send(); });
router.delete("/me", async (req, res) => { await revokeAllSessions(req.user!.id); await db.update(users).set({ displayName: null, avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, req.user!.id)); return res.status(202).json({ status: "account deactivation requested", note: "permanent deletion requires the configured retention worker" }); });
export default router;
