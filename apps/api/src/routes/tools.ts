import { Router } from "express";
import { getTool, listTools, requiresApproval } from "../services/toolRegistry.js";
import { issueToolApproval, prepareToolExecution } from "../services/toolExecution.js";

const router = Router();
const workspaceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get("/", (_req, res) => res.json({ tools: listTools() }));
router.get("/:id", (req, res) => { const tool = getTool(req.params.id); if (!tool) return res.status(404).json({ error: "tool not found" }); return res.json({ tool, requiresApproval: requiresApproval(tool.id) }); });
router.post("/:id/approve", async (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "tool not found" });
  if (!tool.requiresUserApproval) return res.status(400).json({ error: "tool does not require approval" });
  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId.trim() : "";
  if (!workspaceIdPattern.test(workspaceId)) return res.status(400).json({ error: "invalid workspace id" });
  try {
    const approval = await issueToolApproval(tool.id, req.user!.id, workspaceId);
    return approval ? res.json(approval) : res.status(403).json({ error: "workspace access denied" });
  } catch { return res.status(503).json({ error: "approval service unavailable" }); }
});
router.post("/:id/prepare", async (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "tool not found" });
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "invalid tool request" });
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken : undefined;
  if (!workspaceIdPattern.test(workspaceId)) return res.status(400).json({ error: "invalid workspace id" });
  try {
    const result = await prepareToolExecution(tool.id, { userId: req.user!.id, workspaceId, approvalToken });
    if (result.status === "unauthorized") return res.status(403).json({ error: "workspace access denied" });
    if (result.status === "approval_required") return res.status(409).json(result);
    if (result.status === "unavailable") return res.status(503).json(result);
    return res.json(result);
  } catch { return res.status(400).json({ error: "tool execution could not be prepared" }); }
});

export default router;
