import { Router } from "express";
import { createMcpApproval, discoverMcpTools, executeApprovedMcpTool, listConfiguredMcpServers } from "../services/mcpGateway.js";

const router = Router();

router.get("/servers", (_req, res) => res.json({ servers: listConfiguredMcpServers() }));

router.get("/tools", async (_req, res) => {
  try { return res.json({ tools: await discoverMcpTools() }); }
  catch { return res.status(503).json({ error: "MCP discovery unavailable" }); }
});

router.post("/approve", (req, res) => {
  const userId = req.user?.id;
  const serverId = typeof req.body?.serverId === "string" ? req.body.serverId.trim() : "";
  const toolName = typeof req.body?.toolName === "string" ? req.body.toolName.trim() : "";
  if (!userId || !serverId || !toolName) return res.status(400).json({ error: "serverId and toolName are required" });
  try { return res.json({ approval: createMcpApproval({ userId, serverId, toolName }) }); }
  catch { return res.status(400).json({ error: "MCP tool approval unavailable" }); }
});

router.post("/execute", async (req, res) => {
  const userId = req.user?.id;
  const approvalToken = typeof req.body?.approvalToken === "string" ? req.body.approvalToken.trim() : "";
  const serverId = typeof req.body?.serverId === "string" ? req.body.serverId.trim() : "";
  const toolName = typeof req.body?.toolName === "string" ? req.body.toolName.trim() : "";
  if (!userId || !approvalToken || !serverId || !toolName) return res.status(400).json({ error: "approvalToken, serverId and toolName are required" });
  try {
    const result = await executeApprovedMcpTool({ userId, approvalToken, serverId, toolName, arguments: req.body?.arguments });
    return res.json({ result });
  } catch (error) {
    if (error instanceof Error && error.message === "MCP approval required") return res.status(403).json({ error: error.message });
    return res.status(503).json({ error: "MCP tool execution unavailable" });
  }
});

export default router;
