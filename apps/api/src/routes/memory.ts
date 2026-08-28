import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, workspaceMembers } from "@bobai/db";
import { dbRemember, dbRecallAll, dbClearMemory } from "../store/memoryDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
type AuthenticatedRequest = { user?: { id: string }; query: Record<string, unknown>; body?: unknown };
async function context(req: AuthenticatedRequest) {
  const body = req.body as Record<string, unknown> | undefined;
  const requested = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const userId = req.user?.id;
  if (!userId) return null;
  if (!requested) { const workspace = await ensurePersonalWorkspace(userId); return { workspaceId: workspace.id, userId }; }
  if (!/^[0-9a-f-]{36}$/i.test(requested)) return null;
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, userId))).limit(1);
  return member ? { workspaceId: requested, userId } : null;
}
router.get("/", async (req, res) => { try { const ctx = await context(req as AuthenticatedRequest); if (!ctx) return res.status(403).json({ error: "workspace access denied" }); const memories = await dbRecallAll(ctx.workspaceId, ctx.userId); if (!memories) return res.status(503).json({ error: "memory storage unavailable" }); return res.json({ memories, persistent: true, workspaceId: ctx.workspaceId }); } catch { return res.status(503).json({ error: "memory storage unavailable" }); } });
router.post("/remember", async (req, res) => { const { key, value } = req.body || {}; if (typeof key !== "string" || typeof value !== "string" || !key.trim() || !value.trim() || key.length > 200 || value.length > 20_000) return res.status(400).json({ error: "valid key and value are required" }); try { const ctx = await context(req as AuthenticatedRequest); if (!ctx) return res.status(403).json({ error: "workspace access denied" }); if (!await dbRemember({ workspaceId: ctx.workspaceId, userId: ctx.userId, key: key.trim(), value: value.trim() })) return res.status(503).json({ error: "memory storage unavailable" }); return res.json({ success: true, persistent: true, workspaceId: ctx.workspaceId }); } catch { return res.status(503).json({ error: "memory storage unavailable" }); } });
router.delete("/", async (req, res) => { try { const ctx = await context(req as AuthenticatedRequest); if (!ctx) return res.status(403).json({ error: "workspace access denied" }); if (!await dbClearMemory(ctx.workspaceId, ctx.userId)) return res.status(503).json({ error: "memory storage unavailable" }); return res.json({ success: true, persistent: true }); } catch { return res.status(503).json({ error: "memory storage unavailable" }); } });
export default router;
