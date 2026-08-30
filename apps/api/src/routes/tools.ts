import { Router } from "express";
import { getTool, listTools, requiresApproval } from "../services/toolRegistry.js";

const router = Router();

router.get("/", (_req, res) => res.json({ tools: listTools() }));
router.get("/:id", (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "tool not found" });
  return res.json({ tool, requiresApproval: requiresApproval(tool.id) });
});

export default router;
