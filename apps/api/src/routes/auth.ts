import { Router } from "express";
import { createUser, login, refresh, revoke } from "../services/auth.js";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
  const { email: address, username, password } = req.body ?? {};
  if (typeof address !== "string" || !email.test(address) || typeof username !== "string" || !/^[A-Za-z0-9_]{3,32}$/.test(username) || typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: "invalid registration details" });
  }
  try {
    const user = await createUser(address.trim().toLowerCase(), username, password);
    return res.status(201).json({ user });
  } catch {
    return res.status(409).json({ error: "account could not be created" });
  }
});

router.post("/login", async (req, res) => {
  const { email: address, password } = req.body ?? {};
  if (typeof address !== "string" || typeof password !== "string") return res.status(400).json({ error: "invalid credentials" });
  try {
    const session = await login(address.trim().toLowerCase(), password, { userAgent: req.get("user-agent") });
    if (!session) return res.status(401).json({ error: "invalid email or password" });
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

export default router;
