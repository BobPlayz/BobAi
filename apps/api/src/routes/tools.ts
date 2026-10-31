import { Router } from "express";
import { getTool, listTools, requiresApproval } from "../services/toolRegistry.js";
import { issueToolApproval, prepareToolExecution } from "../services/toolExecution.js";
import { executeApprovedTool, serializeToolResult } from "../services/toolLoop.js";
import { validateToolInput } from "../services/toolRegistry.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
function logToolFailure(event: string, error: unknown) { console.error(JSON.stringify({ event, errorType: error instanceof Error ? error.name : "unknown" })); }

const router = Router();
const executeLimit = createUserRateLimit(10, 60_000);
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
    if (result.status === "unavailable") return res.status(503).json({ status: "unavailable", error: "This tool is temporarily unavailable. No action was performed." });
    return res.json(result);
  } catch { return res.status(400).json({ error: "tool execution could not be prepared" }); }
});

// Runs one tool call the user explicitly approved in the chat UI. The approval token is single-use, bound to
// this user, workspace and tool, and consumed inside prepareToolExecution before anything executes.
router.post("/:id/execute", executeLimit, async (req, res) => {
  const tool = getTool(String(req.params.id));
  if (!tool) return res.status(404).json({ error: "tool not found" });
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "invalid tool request" });
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken : undefined;
  const args = body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments) ? body.arguments as Record<string, unknown> : null;
  if (!workspaceIdPattern.test(workspaceId)) return res.status(400).json({ error: "invalid workspace id" });
  if (!args) return res.status(400).json({ error: "tool arguments must be an object" });
  const inputError = validateToolInput(tool, args);
  if (inputError) return res.status(400).json({ error: inputError });
  try {
    const result = await executeApprovedTool(tool.id, args, { userId: req.user!.id, workspaceId, approvalToken });
    if (result && typeof result === "object" && "status" in result && typeof (result as { status?: unknown }).status === "string" && ["approval_required", "unauthorized", "unavailable", "invalid_arguments"].includes((result as { status: string }).status)) {
      const status = (result as { status: string }).status;
      return res.status(status === "unauthorized" ? 403 : status === "approval_required" ? 409 : status === "unavailable" ? 503 : 400).json({ status, error: status === "unauthorized" ? "Workspace access denied." : status === "approval_required" ? "Approval expired or was already used. Please request approval again." : status === "unavailable" ? "This tool is temporarily unavailable. No action was performed." : "The request could not be validated. No action was performed." });
    }
    return res.json({ status: "completed", tool: tool.id, result: serializeToolResult(result) });
  } catch (error) {
    logToolFailure("tool_execute_failed", error);
    return res.status(502).json({ status: "failed", error: "The tool could not complete the request. No successful result was confirmed." });
  }
});

export default router;
