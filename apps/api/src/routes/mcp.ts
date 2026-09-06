import { Router } from "express";
import { discoverMcpTools, listConfiguredMcpServers } from "../services/mcpGateway.js";

const router = Router();

router.get("/servers", (_req, res) => {
  return res.json({ servers: listConfiguredMcpServers() });
});

router.get("/tools", async (_req, res) => {
  try {
    return res.json({ tools: await discoverMcpTools() });
  } catch {
    return res.status(503).json({ error: "MCP discovery unavailable" });
  }
});

export default router;
