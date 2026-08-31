import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, passwordResets, sessions, users } from "@bobai/db";
import { enforcePasswordPolicy } from "./passwordPolicy.js";

const scrypt = (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, keylen, options, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
const TTL_MS = 15 * 60 * 1000;
const SCRYPT = { N: 1 << 14, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");

async function passwordHash(password: string) { const salt = randomBytes(16); const value = await scrypt(password, salt, 64, SCRYPT); return `${salt.toString("base64url")}.${value.toString("base64url")}`; }

export async function requestPasswordReset(email: string) {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  await db.update(passwordResets).set({ isActive: false }).where(and(eq(passwordResets.userId, user.id), eq(passwordResets.isActive, true)));
  const raw = token();
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL_MS) });
  return { email: user.email, token: raw };
}

export async function resetPassword(rawToken: string, password: string) {
  const policyError = await enforcePasswordPolicy(password);
  if (policyError) return { ok: false as const, error: policyError };
  if (typeof rawToken !== "string" || rawToken.length < 32 || rawToken.length > 128) return { ok: false as const, error: "invalid or expired reset token" };
  const [reset] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, hash(rawToken)), eq(passwordResets.isActive, true), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date()))).limit(1);
  if (!reset) return { ok: false as const, error: "invalid or expired reset token" };
  const stored = await passwordHash(password);
  const [updated] = await db.update(passwordResets).set({ usedAt: new Date(), isActive: false }).where(and(eq(passwordResets.id, reset.id), eq(passwordResets.isActive, true), isNull(passwordResets.usedAt))).returning({ id: passwordResets.id });
  if (!updated) return { ok: false as const, error: "invalid or expired reset token" };
  const now = new Date();
  await db.update(users).set({ passwordHash: stored, updatedAt: now }).where(eq(users.id, reset.userId));
  await db.update(sessions).set({ revokedAt: now, isActive: false, updatedAt: now }).where(and(eq(sessions.userId, reset.userId), eq(sessions.isActive, true), isNull(sessions.revokedAt)));
  return { ok: true as const };
}
