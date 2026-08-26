import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, sessions, users } from "@bobai/db";
import { and, eq, gt, isNull } from "drizzle-orm";

const scrypt = promisify(scryptCallback);
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [saltText, hashText] = stored.split(".");
  if (!saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = (await scrypt(password, Buffer.from(saltText, "base64url"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const token = () => randomBytes(32).toString("base64url");

export async function createUser(email: string, username: string, password: string) {
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, username, passwordHash }).returning({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role });
  if (!user) throw new Error("user creation failed");
  return user;
}

export async function login(email: string, password: string, metadata?: Record<string, unknown>) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return issueSession(user.id, metadata);
}

export async function issueSession(userId: string, metadata?: Record<string, unknown>) {
  const accessToken = token();
  const refreshToken = token();
  const now = Date.now();
  await db.insert(sessions).values({ userId, accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken), accessExpiresAt: new Date(now + ACCESS_TTL_MS), expiresAt: new Date(now + REFRESH_TTL_MS), metadata });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_MS / 1000 };
}

export async function authenticateAccessToken(accessToken: string) {
  const [result] = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.accessTokenHash, hashToken(accessToken)), eq(sessions.isActive, true), isNull(sessions.revokedAt), gt(sessions.accessExpiresAt, new Date()))).limit(1);
  if (!result) return null;
  await db.update(sessions).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(eq(sessions.id, result.session.id));
  return result.user;
}

export async function refresh(refreshToken: string) {
  const [session] = await db.select().from(sessions).where(and(eq(sessions.refreshTokenHash, hashToken(refreshToken)), eq(sessions.isActive, true), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  await db.update(sessions).set({ revokedAt: new Date(), isActive: false, updatedAt: new Date() }).where(eq(sessions.id, session.id));
  return issueSession(session.userId);
}

export async function revoke(refreshToken: string) {
  await db.update(sessions).set({ revokedAt: new Date(), isActive: false, updatedAt: new Date() }).where(eq(sessions.refreshTokenHash, hashToken(refreshToken)));
}
