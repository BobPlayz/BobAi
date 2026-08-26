import { Router } from "express";
import { createAutomation, createCodmContentAutomation, getAutomation, listAutomationRuns, listAutomations, runAutomation, type AutomationStep } from "../services/automation.js";

const router = Router();
const allowedSteps = new Set(["research", "generate_image", "generate_video", "edit_video", "upload", "notify"]);

router.get("/", (_req, res) => res.json({ automations: listAutomations() }));
router.get("/runs", (req, res) => res.json({ runs: listAutomationRuns(typeof req.query.automationId === "string" ? req.query.automationId : undefined) }));

router.post("/", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
  if (!name || !steps.length) return res.status(400).json({ error: "name and at least one step are required" });
  if (steps.some((step: any) => !step || !allowedSteps.has(step.type))) return res.status(400).json({ error: "invalid automation step" });
  return res.status(201).json(createAutomation({
    name,
    description: typeof req.body.description === "string" ? req.body.description : undefined,
    trigger: req.body.trigger?.type === "cron" || req.body.trigger?.type === "webhook" ? req.body.trigger : { type: "manual", config: req.body.trigger?.config },
    steps: steps as AutomationStep[],
    enabled: req.body.enabled !== false,
  }));
});

router.post("/codm-video", (_req, res) => res.status(201).json(createCodmContentAutomation()));

router.post("/:id/run", async (req, res) => {
  const automation = getAutomation(req.params.id);
  if (!automation) return res.status(404).json({ error: "automation not found" });
  try { return res.status(202).json(await runAutomation(automation, req.body && typeof req.body === "object" ? req.body : {})); }
  catch (error) {
    const detail = error as { message?: string; run?: unknown };
    return res.status(502).json({ error: detail.message || "automation failed", run: detail.run || null });
  }
});

export default router;
