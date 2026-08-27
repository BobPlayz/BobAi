import { and, eq, isNull } from "drizzle-orm";
import { db, sessions } from "@bobai/db";

export async function revokeAllSessions(userId: string) {
  const now = new Date();
  return db.update(sessions).set({ revokedAt: now, isActive: false, updatedAt: now }).where(and(
    eq(sessions.userId, userId), eq(sessions.isActive, true), isNull(sessions.revokedAt)
  ));
}

export async function listSessions(userId: string) {
  return db.select({
    id: sessions.id,
    deviceName: sessions.deviceName,
    deviceType: sessions.deviceType,
    browser: sessions.browser,
    operatingSystem: sessions.operatingSystem,
    lastUsedAt: sessions.lastUsedAt,
    createdAt: sessions.createdAt,
    expiresAt: sessions.expiresAt
  }).from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.isActive, true), isNull(sessions.revokedAt)));
}

export async function revokeSession(userId: string, sessionId: string) {
  const [session] = await db.update(sessions).set({ revokedAt: new Date(), isActive: false, updatedAt: new Date() }).where(and(
    eq(sessions.id, sessionId), eq(sessions.userId, userId), eq(sessions.isActive, true), isNull(sessions.revokedAt)
  )).returning({ id: sessions.id });
  return Boolean(session);
}
