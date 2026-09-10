import { Router } from "express";
import { listProviderCapabilities } from "../services/capabilityProviders.js";

export const healthRouter = Router();

async function checkDatabase() {
  if (!process.env.DATABASE_URL) return { reachable: false, schemaReady: false };
  try {
    const { db } = await import("@bobai/db");
    const result = await db.execute("select to_regclass('public.users') as users_table, to_regclass('public.email_otps') as email_otps_table");
    const row = result[0] as { users_table: string | null; email_otps_table: string | null } | undefined;
    return { reachable: true, schemaReady: Boolean(row?.users_table && row?.email_otps_table) };
  } catch {
    return { reachable: false, schemaReady: false };
  }
}

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bobai-api", version: "0.1.0" });
});

healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/ready", async (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const [database] = await Promise.all([checkDatabase()]);
  const configuredCapabilities = listProviderCapabilities().filter(({ configured }) => configured).length;
  const databaseReady = databaseConfigured && database.reachable && database.schemaReady;
  const ready = databaseReady;
  const checks = {
    databaseConfigured,
    databaseReachable: database.reachable,
    databaseSchemaReady: database.schemaReady,
    codingAgentsConfigured: Boolean(process.env.BOBAI_CODING_AGENTS_DIR),
    configuredCapabilities,
  };
  return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", checks });
});
