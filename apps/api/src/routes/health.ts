import { Router } from "express";
import { listProviderCapabilities } from "../services/capabilityProviders.js";
import { bobModelProvider } from "../services/modelProvider.js";
import { productionConfigProblems } from "../config/validateProduction.js";
import { otpDeliveryConfigured, otpDeliveryProvider } from "../services/otpDelivery.js";
export const healthRouter = Router();
async function checkDatabase() { if (!process.env.DATABASE_URL) return { reachable: false, schemaReady: false }; try { const { db } = await import("@bobai/db"); const result = await db.execute("select to_regclass('public.users') as users_table, to_regclass('public.email_otps') as email_otps_table, to_regclass('public.rate_limit_buckets') as rate_limit_buckets_table"); const row = result[0] as { users_table: string | null; email_otps_table: string | null; rate_limit_buckets_table: string | null } | undefined; const rateLimitSchemaRequired = process.env.BOBAI_DISTRIBUTED_RATE_LIMIT === "true"; return { reachable: true, schemaReady: Boolean(row?.users_table && row?.email_otps_table && (!rateLimitSchemaRequired || row?.rate_limit_buckets_table)) }; } catch { return { reachable: false, schemaReady: false }; } }
healthRouter.get("/health", (_req, res) => res.json({ status: "ok", service: "jarvis-api", version: "0.1.0", model: "bob" }));
healthRouter.get("/live", (_req, res) => res.json({ status: "ok" }));
healthRouter.get("/ready", async (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const [database, model] = await Promise.all([checkDatabase(), bobModelProvider.status()]);
  const configuredCapabilities = listProviderCapabilities().filter(({ configured }) => configured).length;
  const databaseReady = databaseConfigured && database.reachable && database.schemaReady;
  const emailConfigured = otpDeliveryConfigured();
  const ready = databaseReady && emailConfigured && model.ready;
  // Yes/no checks plus problem categories and missing variable *names*: enough to fix a deployment without logs,
  // never values, hostnames or keys.
  const production = process.env.NODE_ENV === "production";
  const productionConfig = productionConfigProblems();
  const checks = {
    productionMode: production,
    runtime: { nodeEnv: process.env.NODE_ENV ?? null, vercel: process.env.VERCEL === "1", vercelEnv: process.env.VERCEL_ENV ?? null },
    productionConfigReady: productionConfig.length === 0,
    ...(productionConfig.length ? { productionConfigProblems: productionConfig } : {}),
    databaseConfigured,
    databaseReachable: database.reachable,
    databaseSchemaReady: database.schemaReady,
    emailConfigured,
    emailProvider: otpDeliveryProvider(),
    modelConfigured: Boolean(process.env.BOBAI_OLLAMA_BASE_URL?.trim()) || process.env.VERCEL !== "1",
    modelHosted: model.hosted,
    modelReachable: model.ready,
    ...(model.problem ? { modelProblem: model.problem } : {}),
    ...(production ? {} : { modelId: model.model ?? model.requiredModels?.[0], codingAgentsConfigured: Boolean(process.env.BOBAI_CODING_AGENTS_DIR), configuredCapabilities }),
  };
  return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", checks });
});
