import { Router } from "express";
import { getTool, listTools, requiresApproval } from "../services/toolRegistry.js";
import { prepareToolExecution } from "../services/toolExecution.js";

const router = Router();

router.get("/", (_req, res) => res.json({ tools: listTools() }));
router.get("/:id", (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "tool not found" });
  return res.json({ tool, requiresApproval: requiresApproval(tool.id) });
});
router.post("/:id/prepare", (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "tool not found" });
  try {
    const result = prepareToolExecution(tool.id, {
      userId: req.user!.id,
      workspaceId: typeof req.body?.workspaceId === "string" ? req.body.workspaceId : "",
      approved: req.body?.approved === true,
    });
    if (result.status === "approval_required") return res.status(409).json(result);
    if (result.status === "unavailable") return res.status(503).json(result);
    return res.json(result);
  } catch {
    return res.status(400).json({ error: "tool execution could not be prepared" });
  }
});

export default router;
