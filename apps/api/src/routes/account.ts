import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@bobai/db";
import { requireAuth } from "../middleware/auth.js";
import { requestPasswordReset, resetPassword } from "../services/passwordReset.js";
import { listSessions, revokeAllSessions, revokeSession } from "../services/sessionManager.js";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const password = (value: unknown): value is string => typeof value === "string" && value.length >= 12 && value.length <= 128;

router.post("/password-reset/request", async (req, res) => {
  const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email.test(address)) return res.status(400).json({ error: "invalid email" });
  const resetToken = await requestPasswordReset(address);
  return res.status(202).json({ message: "if the account exists, password reset instructions have been created", ...(process.env.NODE_ENV === "development" && resetToken ? { resetToken } : {}) });
});

router.post("/password-reset/confirm", async (req, res) => {
  const { token, password: nextPassword } = req.body ?? {};
  if (typeof token !== "string" || token.length < 32 || !password(nextPassword)) return res.status(400).json({ error: "invalid reset request" });
  if (!await resetPassword(token, nextPassword)) return res.status(400).json({ error: "invalid or expired reset token" });
  return res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, req.user.id)).limit(1);
  return user ? res.json(user) : res.status(404).json({ error: "user not found" });
});

router.get("/sessions", requireAuth, async (req, res) => res.json({ sessions: await listSessions(req.user.id) }));
router.delete("/sessions/:id", requireAuth, async (req, res) => res.status(await revokeSession(req.user.id, req.params.id) ? 204 : 404).send());
router.delete("/sessions", requireAuth, async (req, res) => { await revokeAllSessions(req.user.id); return res.status(204).send(); });

router.delete("/me", requireAuth, async (req, res) => {
  await revokeAllSessions(req.user.id);
  await db.update(users).set({ displayName: null, avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, req.user.id));
  return res.status(202).json({ status: "account deactivation requested", note: "permanent deletion requires the configured retention worker" });
});

export default router;
