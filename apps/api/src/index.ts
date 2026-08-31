import "dotenv/config";
import { app } from "./app.js";
import { configureOtpDelivery } from "./services/otpDelivery.js";
import { startRetentionWorker } from "./services/retention.js";

const PORT = Number(process.env.PORT || 3001);
const SHUTDOWN_TIMEOUT_MS = 10_000;

configureOtpDelivery();
const retentionWorker = startRetentionWorker();

const server = app.listen(PORT, () => {
  console.log(`BobAI API listening on http://localhost:${PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(retentionWorker);
  console.log(`BobAI API received ${signal}; shutting down gracefully`);

  const timeout = setTimeout(() => {
    console.error("BobAI API shutdown timed out; forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timeout.unref();

  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error("BobAI API shutdown failed", error);
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
