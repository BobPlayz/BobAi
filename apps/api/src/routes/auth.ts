import { Router } from "express";
import { createUser, issueSession, login, refresh, revoke } from "../services/auth.js";
import { requestEmailOtp, verifyEmailOtp } from "../services/otp.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const username = /^[A-Za-z0-9_]{3,32}$/;
const authBuckets = new Map<string, { startedAt: number; count: number }>();
const AUTH_WINDOW_MS = 15 * 60_000;
const AUTH_MAX_ATTEMPTS = 10;
const REFRESH_COOKIE = "bobai_refresh";
const ACCESS_COOKIE = "bobai_access";

function limited(req: { ip?: string }, key: string) {
  const now = Date.now();
  const bucketKey = `${req.ip || "unknown"}:${key}`;
  const current = authBuckets.get(bucketKey);
  if (!current || now - current.startedAt >= AUTH_WINDOW_MS) { authBuckets.set(bucketKey, { startedAt: now, count: 1 }); return false; }
  current.count += 1;
  return current.count > AUTH_MAX_ATTEMPTS;
}
function cleanupAuthBuckets() { const cutoff = Date.now() - AUTH_WINDOW_MS; for (const [key, bucket] of authBuckets) if (bucket.startedAt < cutoff) authBuckets.delete(key); }
setInterval(cleanupAuthBuckets, AUTH_WINDOW_MS).unref();
function cookieOptions(maxAge: number) { return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }; }
function readCookie(req: { header(name: string): string | undefined }, name: string) { const header = req.header("cookie") || ""; const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length + 1)) : ""; }
function setSessionCookies(res: { cookie(name: string, value: string, options: object): void }, session: { accessToken: string; refreshToken: string }) { res.cookie(ACCESS_COOKIE, session.accessToken, cookieOptions(15 * 60 * 1000)); res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000)); }

router.post("/register", async (req, res) => {
  const { email: address, username: name, password } = req.body ?? {};
  const normalizedEmail = typeof address === "string" ? address.trim().toLowerCase() : "";
  const normalizedUsername = typeof name === "string" ? name.trim() : "";
  if (!email.test(normalizedEmail) || !username.test(normalizedUsername) || typeof password !== "string" || password.length < 12 || password.length > 128) return res.status(400).json({ error: "invalid registration details" });
  if (limited(req, "register")) return res.status(429).json({ error: "too many registration attempts", retryAfterSeconds: 900 });
  try { const user = await createUser(normalizedEmail, normalizedUsername, password); const session = await issueSession(user.id, { userAgent: req.get("user-agent") }); setSessionCookies(res, session); return res.status(201).json({ accessToken: session.accessToken, expiresIn: session.expiresIn, user }); }
  catch (error) { const databaseError = error as { code?: string; constraint?: string }; if (databaseError.code === "23505") { if (databaseError.constraint?.includes("email")) return res.status(409).json({ error: "an account with this email already exists" }); if (databaseError.constraint?.includes("username")) return res.status(409).json({ error: "that username is already taken" }); return res.status(409).json({ error: "an account with these details already exists" }); } if (process.env.NODE_ENV !== "production") console.error("[AUTH] registration failed", error); return res.status(503).json({ error: "account service unavailable" }); }
});

router.post("/login", async (req, res) => {
  const { email: address, password } = req.body ?? {};
  const normalizedEmail = typeof address === "string" ? address.trim().toLowerCase() : "";
  if (typeof address !== "string" || typeof password !== "string") return res.status(400).json({ error: "invalid credentials" });
  if (limited(req, `login:${normalizedEmail.slice(0, 254)}`)) return res.status(429).json({ error: "too many login attempts", retryAfterSeconds: 900 });
  try { const session = await login(normalizedEmail, password, { userAgent: req.get("user-agent") }); if (!session) return res.status(401).json({ error: "invalid email or password" }); setSessionCookies(res, session); return res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn }); }
  catch (error) { if (process.env.NODE_ENV !== "production") console.error("[AUTH] login failed", error); return res.status(503).json({ error: "authentication service unavailable" }); }
});

router.post("/refresh", async (req, res) => { const refreshToken = readCookie(req, REFRESH_COOKIE); if (!refreshToken) return res.status(401).json({ error: "refresh token required" }); const session = await refresh(refreshToken); if (!session) { res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }); res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }); return res.status(401).json({ error: "invalid or expired session" }); } setSessionCookies(res, session); return res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn }); });
router.post("/logout", async (req, res) => { const refreshToken = readCookie(req, REFRESH_COOKIE); if (refreshToken) await revoke(refreshToken); res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }); res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }); return res.status(204).send(); });
router.post("/otp/request", async (req, res) => { const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : ""; if (!email.test(address)) return res.status(400).json({ error: "invalid email" }); if (limited(req, `otp-request:${address.slice(0, 254)}`)) return res.status(429).json({ error: "too many verification requests", retryAfterSeconds: 900 }); try { await requestEmailOtp(address); return res.status(202).json({ message: "if the account exists, a verification code has been sent" }); } catch (error) { if (process.env.NODE_ENV !== "production") console.error("[AUTH] otp delivery failed", error); return res.status(503).json({ error: "verification email could not be sent right now" }); } });
router.post("/otp/verify", async (req, res) => { const address = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : ""; const code = typeof req.body?.code === "string" ? req.body.code : ""; if (!email.test(address) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "invalid verification code" }); if (limited(req, `otp-verify:${address.slice(0, 254)}`)) return res.status(429).json({ error: "too many verification attempts", retryAfterSeconds: 900 }); try { if (!await verifyEmailOtp(address, code)) return res.status(400).json({ error: "invalid or expired verification code" }); return res.json({ verified: true }); } catch (error) { if (process.env.NODE_ENV !== "production") console.error("[AUTH] otp verification failed", error); return res.status(503).json({ error: "verification unavailable" }); } });
router.get("/status", requireAuth, (req, res) => res.json({ userId: req.user!.id }));
export default router;
