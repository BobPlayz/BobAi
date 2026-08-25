import { Router } from "express";
import { remember, recall, recallAll, clearMemory } from "../memory/memory.js";
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
  if (ctx) {
    const memories = await dbRecallAll(ctx.workspaceId, ctx.userId).catch(() => null);
    if (memories) return res.json({ memories, persistent: true });
  }
  return res.json({ memories: recallAll(), persistent: false });
});

router.post("/remember", async (req, res) => {
  const { key, value } = req.body || {};
  if (typeof key !== "string" || typeof value !== "string" || !key.trim() || !value.trim()) return res.status(400).json({ error: "key and value required" });
  const ctx = context(req);
  if (ctx) {
    const saved = await dbRemember({ workspaceId: ctx.workspaceId, userId: ctx.userId, key: key.trim(), value: value.trim() }).catch(() => false);
    if (saved) return res.json({ success: true, persistent: true });
  }
  remember(key, value);
  return res.json({ success: true, persistent: false });
});

router.get("/:key", (req, res) => res.json({ value: recall(req.params.key) }));
router.delete("/", async (req, res) => {
  const ctx = context(req);
  if (ctx) {
    const cleared = await dbClearMemory(ctx.workspaceId, ctx.userId).catch(() => false);
    if (cleared) return res.json({ success: true, persistent: true });
  }
  clearMemory();
  return res.json({ success: true, persistent: false });
});
export default router;
