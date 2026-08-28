import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, workspaceMembers } from "@bobai/db";
import { requireAuth } from "../middleware/auth.js";
import { dbDeleteConversation, dbGetConversation, dbListConversations, dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
router.use(requireAuth);

type RequestContext = { userId: string; workspaceId: string };
type AuthenticatedRequest = Request & { user: { id: string } };

async function requireContext(req: AuthenticatedRequest, res: Response): Promise<RequestContext | null> {
  const body = req.body as Record<string, unknown> | undefined;
  const requested = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  if (!requested) {
    try {
      const workspace = await ensurePersonalWorkspace(req.user.id);
      return { userId: req.user.id, workspaceId: workspace.id };
    } catch {
      res.status(503).json({ error: "personal workspace unavailable" });
      return null;
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(requested)) {
    res.status(400).json({ error: "invalid workspace context" });
    return null;
  }
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, req.user.id))).limit(1);
  if (!member) {
    res.status(403).json({ error: "workspace access denied" });
    return null;
  }
  return { userId: req.user.id, workspaceId: requested };
}

router.get("/", async (req, res) => {
  try {
    const context = await requireContext(req as AuthenticatedRequest, res);
    if (!context) return;
    const conversations = await dbListConversations(context.userId, context.workspaceId);
    if (!conversations) return res.status(503).json({ error: "persistent storage unavailable" });
    return res.json({ conversations, workspaceId: context.workspaceId });
  } catch {
    return res.status(500).json({ error: "failed to list conversations" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const context = await requireContext(req as AuthenticatedRequest, res);
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
    const context = await requireContext(req as AuthenticatedRequest, res);
    if (!context) return;
    const saved = await dbSaveConversation({
      id: conversation.id,
      userId: context.userId,
      workspaceId: context.workspaceId,
      title: conversation.title.slice(0, 200),
      messages: conversation.messages as Array<{ id?: string; role: string; content: string; model?: string | null; status?: string; attachments?: unknown }>,
    });
    if (!saved) return res.status(503).json({ error: "persistent storage unavailable" });
    return res.json({ success: true, persistent: true, workspaceId: context.workspaceId });
  } catch {
    return res.status(500).json({ error: "failed to save conversation" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const context = await requireContext(req as AuthenticatedRequest, res);
    if (!context) return;
    const deleted = await dbDeleteConversation(req.params.id as string, context.userId, context.workspaceId);
    if (!deleted) return res.status(404).json({ error: "conversation not found" });
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(500).json({ error: "failed to delete conversation" });
  }
});

export default router;
