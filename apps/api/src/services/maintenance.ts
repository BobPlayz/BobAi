import { cleanupExpiredOtps } from "./otp.js";
import { cleanupExpiredPasswordResets } from "./passwordReset.js";
import { cleanupExpiredSessions } from "./sessionManager.js";

const INTERVAL_MS = 15 * 60_000;

async function runMaintenance() {
  try {
    await Promise.all([
      cleanupExpiredOtps(),
      cleanupExpiredPasswordResets(),
      cleanupExpiredSessions(),
    ]);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("maintenance cleanup failed", error);
  }
}

export function startMaintenance() {
  const timer = setInterval(() => { void runMaintenance(); }, INTERVAL_MS);
  timer.unref();
  return timer;
}
