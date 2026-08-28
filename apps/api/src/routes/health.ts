import { Router } from "express";
import { ollamaProvider } from "../services/ollamaProvider.js";

export const healthRouter = Router();

async function checkDatabase() {
  if (!process.env.DATABASE_URL) return false;
  try {
    const { db } = await import("@bobai/db");
    await db.execute("select 1");
    return true;
  } catch {
    return false;
  }
}

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bobai-api", version: "0.1.0" });
});

healthRouter.get("/ready", async (_req, res) => {
  const [database, ollama] = await Promise.all([checkDatabase(), ollamaProvider.registryStatus()]);
  const checks = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: database,
    ollamaConfigured: Boolean(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL),
    ollamaReachable: ollama.connected,
    ollamaBaseUrl: ollama.baseUrl,
    installedModels: ollama.models.filter((model) => model.installed).map((model) => model.model),
    codingAgentsConfigured: Boolean(process.env.BOBAI_CODING_AGENTS_DIR),
    videoProviderConfigured: Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL),
  };
  const ready = ollama.connected && (!checks.databaseConfigured || database);
  return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", checks });
});
