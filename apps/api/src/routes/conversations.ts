import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, workspaceMembers } from "@bobai/db";
import { requireAuth } from "../middleware/auth.js";
import { dbDeleteConversation, dbGetConversation, dbListConversations, dbSaveConversation } from "../store/conversationDb.js";

const router = Router();
router.use(requireAuth);

type RequestContext = { userId: string; workspaceId: string };

function workspaceId(req: { query: Record<string, unknown>; body?: unknown }) {
  const body = req.body as Record<string, unknown> | undefined;
  const value = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  return /^[0-9a-f-]{36}$/i.test(value) ? value : "";
}

async function requireContext(req: Parameters<typeof workspaceId>[0], res: Parameters<Router["get"]>[1]): Promise<RequestContext | null> {
  const id = workspaceId(req);
  if (!id) {
    res.status(400).json({ error: "workspace context is required" });
    return null;
  }
  const userId = (req as typeof req & { user: { id: string } }).user.id;
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId))).limit(1);
  if (!member) {
    res.status(403).json({ error: "workspace access denied" });
    return null;
  }
  return { userId, workspaceId: id };
}

router.get("/", async (req, res) => {
  try {
    const context = await requireContext(req, res);
    if (!context) return;
    const conversations = await dbListConversations(context.userId, context.workspaceId);
    if (!conversations) return res.status(503).json({ error: "persistent storage unavailable" });
    return res.json({ conversations });
  } catch {
    return res.status(500).json({ error: "failed to list conversations" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const context = await requireContext(req, res);
    if (!context) return;
    const conversation = await dbGetConversation(req.params.id as string, context.userId, context.workspaceId);
    if (!conversation) return res.status(404).json({ error: "conversation not found" });
    return res.json(conversation);
  } catch {
    return res.status(500).json({ error: "failed to get conversation" });
  }
});

router.post("/", async (req, res) => {
  const conversation = req.body as Record<string, unknown>;
  if (typeof conversation?.id !== "string" || typeof conversation?.title !== "string" || !Array.isArray(conversation?.messages)) return res.status(400).json({ error: "id, title, and messages are required" });
  try {
    const context = await requireContext(req, res);
    if (!context) return;
    const saved = await dbSaveConversation({
      id: conversation.id,
      userId: context.userId,
      workspaceId: context.workspaceId,
      title: conversation.title,
      messages: conversation.messages as Array<{ id?: string; role: string; content: string; model?: string | null; status?: string }>,
    });
    if (!saved) return res.status(503).json({ error: "persistent storage unavailable" });
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(500).json({ error: "failed to save conversation" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const context = await requireContext(req, res);
    if (!context) return;
    const deleted = await dbDeleteConversation(req.params.id as string, context.userId, context.workspaceId);
    if (!deleted) return res.status(404).json({ error: "conversation not found" });
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(500).json({ error: "failed to delete conversation" });
  }
});

export default router;
