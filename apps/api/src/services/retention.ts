import { and, lt, or, eq, isNotNull } from "drizzle-orm";
import { db, emailOtps, passwordResets, sessions } from "@bobai/db";

const OTP_RETENTION_MS = 24 * 60 * 60 * 1000;
const RESET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function runRetentionCleanup(now = new Date()) {
  const otpCutoff = new Date(now.getTime() - OTP_RETENTION_MS);
  const resetCutoff = new Date(now.getTime() - RESET_RETENTION_MS);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_MS);

  const [otps, resets, sessionsDeleted] = await Promise.all([
    db.delete(emailOtps).where(lt(emailOtps.createdAt, otpCutoff)).returning({ id: emailOtps.id }),
    db.delete(passwordResets).where(lt(passwordResets.createdAt, resetCutoff)).returning({ id: passwordResets.id }),
    db.delete(sessions).where(and(
      lt(sessions.createdAt, sessionCutoff),
      or(eq(sessions.isActive, false), isNotNull(sessions.revokedAt))
    )).returning({ id: sessions.id }),
  ]);

  return { otpRows: otps.length, passwordResetRows: resets.length, sessionRows: sessionsDeleted.length };
}

export function startRetentionWorker(intervalMs = 60 * 60 * 1000) {
  const safeInterval = Math.max(60_000, intervalMs);
  const timer = setInterval(() => {
    void runRetentionCleanup().catch((error) => {
      if (process.env.NODE_ENV !== "production") console.warn("retention cleanup failed", error);
    });
  }, safeInterval);
  timer.unref();
  return timer;
}
