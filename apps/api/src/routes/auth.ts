import { Router } from "express";
import { createUser, issueSession, login, refresh, revoke } from "../services/auth.js";
import { requestEmailOtp, verifyEmailOtp } from "../services/otp.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const username = /^[A-Za-z0-9_]{3,32}$/;

router.post("/register", async (req, res) => {
  const { email: address, username: name, password } = req.body ?? {};
  const normalizedEmail = typeof address === "string" ? address.trim().toLowerCase() : "";
  const normalizedUsername = typeof name === "string" ? name.trim() : "";

  if (!email.test(normalizedEmail) || !username.test(normalizedUsername) || typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: "invalid registration details" });
  }

  try {
    const user = await createUser(normalizedEmail, normalizedUsername, password);
    const session = await issueSession(user.id, { userAgent: req.get("user-agent") });
    return res.status(201).json({ ...session, user });
  } catch (error) {
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === "23505") {
      if (databaseError.constraint?.includes("email")) return res.status(409).json({ error: "an account with this email already exists" });
      if (databaseError.constraint?.includes("username")) return res.status(409).json({ error: "that username is already taken" });
      return res.status(409).json({ error: "an account with these details already exists" });
    }
    console.error("[AUTH] registration failed", error);
    return res.status(503).json({ error: "account service unavailable" });
  }
});

router.post("/login", async (req, res) => {
  const { email: address, password } = req.body ?? {};
  if (typeof address !== "string" || typeof password !== "string") return res.status(400).json({ error: "invalid credentials" });

  try {
    const session = await login(address.trim().toLowerCase(), password, { userAgent: req.get("user-agent") });
    if (!session) return res.status(401).json({ error: "invalid email or password" });
    return res.json(session);
  } catch (error) {
    console.error("[AUTH] login failed", error);
    return res.status(503).json({ error: "authentication service unavailable" });
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
  } catch (error) {
    console.error("[AUTH] otp delivery failed", error);
    return res.status(503).json({ error: "verification email could not be sent right now" });
  }
});

router.post("/otp/verify", async (req, res) => {
  const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!email.test(address) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "invalid verification code" });
  try {
    if (!await verifyEmailOtp(address, code)) return res.status(400).json({ error: "invalid or expired verification code" });
    return res.json({ verified: true });
  } catch (error) {
    console.error("[AUTH] otp verification failed", error);
    return res.status(503).json({ error: "verification unavailable" });
  }
});

router.get("/status", requireAuth, (req, res) => res.json({ userId: req.user!.id }));

export default router;
