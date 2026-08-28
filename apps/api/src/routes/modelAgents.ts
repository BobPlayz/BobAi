import { Router } from "express";
import { agentAuth } from "../middleware/agentAuth.js";
import { AGENT_REGISTRY, MODEL_REGISTRY, VISION_ARCHITECTURE } from "../services/modelRegistry.js";
import { ollamaProvider } from "../services/ollamaProvider.js";
import { getCodingOrchestration, listCodingOrchestrations, runCodingOrchestration } from "../services/codingOrchestrator.js";

const router = Router();

router.get("/models", agentAuth, async (_req, res) => {
  return res.json({ registry: MODEL_REGISTRY, ollama: await ollamaProvider.registryStatus(), vision: VISION_ARCHITECTURE });
});

router.get("/agents", agentAuth, (_req, res) => res.json({ agents: Object.values(AGENT_REGISTRY) }));
router.get("/orchestrations", agentAuth, (_req, res) => res.json({ runs: listCodingOrchestrations() }));

router.get("/orchestrations/:id", agentAuth, (req, res) => {
  const run = getCodingOrchestration(req.params.id as string);
  if (!run) return res.status(404).json({ error: "orchestration not found" });
  return res.json(run);
});

router.post("/orchestrations", agentAuth, async (req, res) => {
  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!task) return res.status(400).json({ error: "task is required" });
  if (task.length > 20_000) return res.status(413).json({ error: "task cannot exceed 20000 characters" });
  try {
    const run = await runCodingOrchestration(task);
    return res.status(200).json(run);
  } catch (error) {
    const run = error && typeof error === "object" && "run" in error ? (error as { run?: unknown }).run : undefined;
    return res.status(503).json({ error: error instanceof Error ? error.message : "orchestration failed", run });
  }
});

export default router;
