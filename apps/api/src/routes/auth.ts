import { Router } from "express";
import { createUser, login, refresh, revoke } from "../services/auth.js";
import { requestEmailOtp, verifyEmailOtp } from "../services/otp.js";
import { requireAuth } from "../middleware/auth.js";
import { db, users } from "@bobai/db";
import { eq } from "drizzle-orm";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
  const { email: address, username, password } = req.body ?? {};
  if (typeof address !== "string" || !email.test(address) || typeof username !== "string" || !/^[A-Za-z0-9_]{3,32}$/.test(username) || typeof password !== "string" || password.length < 12 || password.length > 128) return res.status(400).json({ error: "invalid registration details" });
  try {
    const normalizedEmail = address.trim().toLowerCase();
    const user = await createUser(normalizedEmail, username, password);
    await requestEmailOtp(normalizedEmail);
    return res.status(201).json({ user, verificationRequired: true });
  } catch {
    return res.status(409).json({ error: "account could not be created" });
  }
});

router.post("/login", async (req, res) => {
  const { email: address, password } = req.body ?? {};
  if (typeof address !== "string" || typeof password !== "string") return res.status(400).json({ error: "invalid credentials" });
  try {
    const normalizedEmail = address.trim().toLowerCase();
    const [user] = await db.select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!user) return res.status(401).json({ error: "invalid email or password" });
    const session = await login(normalizedEmail, password, { userAgent: req.get("user-agent") });
    if (!session) return res.status(401).json({ error: "invalid email or password" });
    if (!user.emailVerifiedAt) return res.status(403).json({ error: "email verification required", verificationRequired: true, email: normalizedEmail });
    return res.json(session);
  } catch {
    return res.status(401).json({ error: "invalid email or password" });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string" || !refreshToken) return res.status(400).json({ error: "refresh token required" });
  const session = await refresh(refreshToken);
  if (!session) return res.status(401).json({ error: "invalid or expired refresh token" });
  return res.json(session);
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken === "string" && refreshToken) await revoke(refreshToken);
  return res.status(204).send();
});

router.post("/otp/request", async (req, res) => {
  const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email.test(address)) return res.status(400).json({ error: "invalid email" });
  try {
    await requestEmailOtp(address);
    return res.status(202).json({ message: "if the account exists, a verification code has been sent" });
  } catch {
    return res.status(503).json({ error: "verification unavailable" });
  }
});

router.post("/otp/verify", async (req, res) => {
  const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!email.test(address) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "invalid verification code" });
  try {
    if (!await verifyEmailOtp(address, code)) return res.status(400).json({ error: "invalid or expired verification code" });
    return res.json({ verified: true });
  } catch {
    return res.status(503).json({ error: "verification unavailable" });
  }
});

router.get("/status", requireAuth, (req, res) => res.json({ userId: req.user!.id }));

export default router;
