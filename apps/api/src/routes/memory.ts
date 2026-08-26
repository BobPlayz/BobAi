import { Router } from "express";
import { dbRemember, dbRecallAll, dbClearMemory } from "../store/memoryDb.js";

const router = Router();

function context(req: { query: Record<string, unknown>; body?: unknown }) {
  const body = req.body as Record<string, unknown> | undefined;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const userId = typeof req.query.userId === "string" ? req.query.userId : typeof body?.userId === "string" ? body.userId : undefined;
  return workspaceId ? { workspaceId, userId } : null;
}

router.get("/", async (req, res) => {
  const ctx = context(req);
  if (!ctx) return res.status(401).json({ error: "authenticated user and workspace are required" });
  try {
    const memories = await dbRecallAll(ctx.workspaceId, ctx.userId);
    return res.json({ memories, persistent: true });
  } catch {
    return res.status(503).json({ error: "memory storage unavailable" });
  }
});

router.post("/remember", async (req, res) => {
  const { key, value } = req.body || {};
  if (typeof key !== "string" || typeof value !== "string" || !key.trim() || !value.trim() || key.length > 200 || value.length > 20_000) {
    return res.status(400).json({ error: "valid key and value are required" });
  }
  const ctx = context(req);
  if (!ctx) return res.status(401).json({ error: "authenticated user and workspace are required" });
  try {
    await dbRemember({ workspaceId: ctx.workspaceId, userId: ctx.userId, key: key.trim(), value: value.trim() });
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(503).json({ error: "memory storage unavailable" });
  }
});

router.delete("/", async (req, res) => {
  const ctx = context(req);
  if (!ctx) return res.status(401).json({ error: "authenticated user and workspace are required" });
  try {
    await dbClearMemory(ctx.workspaceId, ctx.userId);
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(503).json({ error: "memory storage unavailable" });
  }
});

export default router;
