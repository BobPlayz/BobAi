import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bobai-api", version: "0.1.0" });
});

healthRouter.get("/ready", (_req, res) => {
  const checks = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    ollamaConfigured: Boolean(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL),
    codingAgentsConfigured: Boolean(process.env.BOBAI_CODING_AGENTS_DIR),
    videoProviderConfigured: Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL),
  };

  const requiredReady = checks.ollamaConfigured || Boolean(process.env.BOBAI_MODEL);
  return res.status(requiredReady ? 200 : 503).json({ status: requiredReady ? "ready" : "degraded", checks });
});
