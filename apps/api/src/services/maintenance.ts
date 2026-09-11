import { cleanupExpiredOtps } from "./otp.js";
import { cleanupExpiredPasswordResets } from "./passwordReset.js";
import { cleanupExpiredSessions } from "./sessionManager.js";
import { cleanupExpiredToolApprovals } from "./toolExecution.js";
import { runRetentionCleanup } from "./retention.js";

const INTERVAL_MS = 15 * 60_000;

async function runMaintenance() {
  try {
    await Promise.all([
      cleanupExpiredOtps(),
      cleanupExpiredPasswordResets(),
      cleanupExpiredSessions(),
      cleanupExpiredToolApprovals(),
      runRetentionCleanup(),
    ]);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("maintenance cleanup failed", error);
  }
}

export function startMaintenance() {
  void runMaintenance();
  const timer = setInterval(() => { void runMaintenance(); }, INTERVAL_MS);
  timer.unref();
  return timer;
}
