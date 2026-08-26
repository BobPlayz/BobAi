import { Router } from "express";
import { createAutomation, createCodmContentAutomation, getAutomation, listAutomationRuns, listAutomations, runAutomation, type AutomationStep } from "../services/automation.js";
import { agentAuth } from "../middleware/agentAuth.js";

const router = Router();
const allowedSteps = new Set<AutomationStep["type"]>(["research", "generate_image", "generate_video", "edit_video", "upload", "notify"]);

type AutomationBody = {
  name?: unknown;
  description?: unknown;
  steps?: unknown;
  trigger?: unknown;
  enabled?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSteps(value: unknown): AutomationStep[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const steps: AutomationStep[] = [];
  for (const step of value) {
    if (!isRecord(step) || typeof step.type !== "string" || !allowedSteps.has(step.type as AutomationStep["type"])) return null;
    steps.push(step as unknown as AutomationStep);
  }
  return steps;
}

router.get("/", agentAuth, (_req, res) => res.json({ automations: listAutomations() }));
router.get("/runs", agentAuth, (req, res) => {
  const automationId = typeof req.query.automationId === "string" ? req.query.automationId : undefined;
  return res.json({ runs: listAutomationRuns(automationId) });
});

router.post("/", agentAuth, (req, res) => {
  const body = (isRecord(req.body) ? req.body : {}) as AutomationBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const steps = parseSteps(body.steps);
  if (!name || !steps) return res.status(400).json({ error: "name and valid steps are required" });
  if (name.length > 200) return res.status(413).json({ error: "automation name is too large" });

  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : undefined;
  const trigger = isRecord(body.trigger) && (body.trigger.type === "cron" || body.trigger.type === "webhook")
    ? body.trigger
    : { type: "manual", config: {} };

  return res.status(201).json(createAutomation({
    name,
    description,
    trigger: trigger as Parameters<typeof createAutomation>[0]["trigger"],
    steps,
    enabled: body.enabled !== false,
  }));
});

router.post("/codm-video", agentAuth, (_req, res) => res.status(201).json(createCodmContentAutomation()));

router.post("/:id/run", agentAuth, async (req, res) => {
  const automation = getAutomation(req.params.id);
  if (!automation) return res.status(404).json({ error: "automation not found" });
  try {
    const run = await runAutomation(automation, isRecord(req.body) ? req.body : {});
    return res.status(202).json({ id: run.id, automationId: run.automationId, status: run.status, createdAt: run.createdAt });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "automation failed" });
  }
});

export default router;
