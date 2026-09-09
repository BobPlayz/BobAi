import "dotenv/config";
import { app } from "./app.js";
import { configureOtpDelivery } from "./services/otpDelivery.js";
import { runRetentionCleanup, startRetentionWorker } from "./services/retention.js";
import { startReminderWorker } from "./services/reminderWorker.js";
const PORT = Number(process.env.PORT || 3001); const SHUTDOWN_TIMEOUT_MS = 10_000; const REQUEST_TIMEOUT_MS = Math.min(Math.max(Number(process.env.API_REQUEST_TIMEOUT_MS || 180_000), 30_000), 600_000); const HEADERS_TIMEOUT_MS = Math.max(REQUEST_TIMEOUT_MS + 10_000, 40_000); const KEEP_ALIVE_TIMEOUT_MS = Math.min(Math.max(Number(process.env.API_KEEP_ALIVE_TIMEOUT_MS || 5_000), 1_000), 120_000);
configureOtpDelivery(); void runRetentionCleanup().catch((error) => { if (process.env.NODE_ENV !== "production") console.warn("initial retention cleanup failed", error); });
const retentionWorker = startRetentionWorker(); const reminderWorker = startReminderWorker();
const server = app.listen(PORT, () => { console.log(`BobAI API listening on http://localhost:${PORT}`); });
server.requestTimeout = REQUEST_TIMEOUT_MS; server.headersTimeout = HEADERS_TIMEOUT_MS; server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
let shuttingDown = false;
async function shutdown(signal: string) { if (shuttingDown) return; shuttingDown = true; clearInterval(retentionWorker); clearInterval(reminderWorker); console.log(`BobAI API received ${signal}; shutting down gracefully`); const timeout = setTimeout(() => { console.error("BobAI API shutdown timed out; forcing exit"); process.exit(1); }, SHUTDOWN_TIMEOUT_MS); timeout.unref(); server.close((error) => { clearTimeout(timeout); if (error) { console.error("BobAI API shutdown failed", error); process.exitCode = 1; return; } process.exitCode = 0; }); }
process.once("SIGTERM", () => void shutdown("SIGTERM")); process.once("SIGINT", () => void shutdown("SIGINT"));
