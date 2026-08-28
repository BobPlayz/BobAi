import { Router } from "express";
import { ollamaProvider } from "../services/ollamaProvider.js";

export const healthRouter = Router();

async function checkDatabase() {
  if (!process.env.DATABASE_URL) return { reachable: false, schemaReady: false };
  try {
    const { db } = await import("@bobai/db");
    const result = await db.execute("select to_regclass('public.users') as users_table, to_regclass('public.email_otps') as email_otps_table");
    const row = result[0] as { users_table: string | null; email_otps_table: string | null } | undefined;
    return {
      reachable: true,
      schemaReady: Boolean(row?.users_table && row?.email_otps_table)
    };
  } catch {
    return { reachable: false, schemaReady: false };
  }
}

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bobai-api", version: "0.1.0" });
});

healthRouter.get("/ready", async (_req, res) => {
  const [database, ollama] = await Promise.all([checkDatabase(), ollamaProvider.registryStatus()]);
  const checks = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: database.reachable,
    databaseSchemaReady: database.schemaReady,
    ollamaConfigured: Boolean(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL),
    ollamaReachable: ollama.connected,
    ollamaBaseUrl: ollama.baseUrl,
    installedModels: ollama.models.filter((model) => model.installed).map((model) => model.model),
    codingAgentsConfigured: Boolean(process.env.BOBAI_CODING_AGENTS_DIR),
    videoProviderConfigured: Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL),
  };
  const ready = ollama.connected && (!checks.databaseConfigured || (database.reachable && database.schemaReady));
  return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", checks });
});
