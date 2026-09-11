import { cleanupExpiredOtps } from "./otp.js";
import { cleanupExpiredPasswordResets } from "./passwordReset.js";
import { cleanupExpiredSessions } from "./sessionManager.js";
import { cleanupExpiredToolApprovals } from "./toolExecution.js";
import { cleanupExpiredMemories } from "../store/memoryDb.js";
import { runRetentionCleanup } from "./retention.js";
import { startAutomationWorker } from "./automation.js";
import { startReminderWorker } from "./reminderWorker.js";
import { cleanupWebhookDeliveries } from "./webhooks.js";
import { cleanupIdempotency } from "./actionIdempotency.js";
import { cleanupDistributedRateLimits } from "./distributedRateLimit.js";
import { cleanupResearchQuotas } from "./researchQuota.js";
import { cleanupOAuthStates } from "./oauth.js";
const INTERVAL_MS = 15 * 60_000;
async function runMaintenance() { try { const tasks: Promise<unknown>[] = [cleanupExpiredOtps(), cleanupExpiredPasswordResets(), cleanupExpiredSessions(), cleanupExpiredToolApprovals(), cleanupExpiredMemories(), runRetentionCleanup(), cleanupWebhookDeliveries(), cleanupIdempotency(), cleanupResearchQuotas(), cleanupOAuthStates()]; if (process.env.BOBAI_DISTRIBUTED_RATE_LIMIT === "true") tasks.push(cleanupDistributedRateLimits()); await Promise.all(tasks); } catch (error) { if (process.env.NODE_ENV !== "production") console.warn("maintenance cleanup failed", error); } }
export function startMaintenance() { void runMaintenance(); void startAutomationWorker().catch((error) => { if (process.env.NODE_ENV !== "production") console.warn("automation worker startup failed", error); }); startReminderWorker(); const timer = setInterval(() => { void runMaintenance(); }, INTERVAL_MS); timer.unref(); return timer; }
