import { Router } from "express";
import { executeSkill, getSkill, listSkills } from "../services/skillRegistry.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ skills: listSkills() });
});

router.get("/:id", (req, res) => {
  const skill = getSkill(req.params.id);
  if (!skill) return res.status(404).json({ error: "skill not found" });
  return res.json(skill);
});

router.post("/:id/execute", async (req, res) => {
  const skill = getSkill(req.params.id);
  if (!skill) return res.status(404).json({ error: "skill not found" });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "request body must be an object" });
  }

  try {
    const result = await executeSkill(skill.id, req.body as Record<string, unknown>);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "skill execution failed";
    const status = /unknown skill|not configured|must use|must be an object/i.test(message) ? 400 : 502;
    if (process.env.NODE_ENV !== "production") console.error("SKILL ROUTE ERROR:", error);
    return res.status(status).json({ error: message, skill: skill.id });
  }
});

export default router;
