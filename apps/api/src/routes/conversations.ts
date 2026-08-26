import { Router } from "express";
import { listConversations, getConversation, saveConversation, deleteConversation } from "../store/conversations.js";
import { dbDeleteConversation, dbGetConversation, dbListConversations, dbSaveConversation } from "../store/conversationDb.js";

const router = Router();

type RequestContext = { userId: string; workspaceId: string };

function dbContext(req: { query: Record<string, unknown>; body?: unknown }): RequestContext | null {
  const body = req.body as Record<string, unknown> | undefined;
  const userId = typeof req.query.userId === "string" ? req.query.userId : typeof body?.userId === "string" ? body.userId : "";
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  return userId && workspaceId ? { userId, workspaceId } : null;
}

function requireContext(req: Parameters<typeof dbContext>[0], res: Parameters<Router["get"]>[1]) {
  const context = dbContext(req);
  if (!context) {
    res.status(401).json({ error: "authenticated user and workspace context are required" });
    return null;
  }
  return context;
}

router.get("/", async (req, res) => {
  try {
    const context = requireContext(req, res);
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
    const context = requireContext(req, res);
    if (!context) return;
    const conversation = await dbGetConversation(req.params.id, context.userId, context.workspaceId);
    if (!conversation) return res.status(404).json({ error: "conversation not found" });
    return res.json(conversation);
  } catch {
    return res.status(500).json({ error: "failed to get conversation" });
  }
});

router.post("/", async (req, res) => {
  const conversation = req.body as Record<string, unknown>;
  if (typeof conversation?.id !== "string" || typeof conversation?.title !== "string" || !Array.isArray(conversation?.messages)) {
    return res.status(400).json({ error: "id, title, and messages are required" });
  }
  try {
    const context = requireContext(req, res);
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
    const context = requireContext(req, res);
    if (!context) return;
    const deleted = await dbDeleteConversation(req.params.id, context.userId, context.workspaceId);
    if (!deleted) return res.status(404).json({ error: "conversation not found" });
    return res.json({ success: true, persistent: true });
  } catch {
    return res.status(500).json({ error: "failed to delete conversation" });
  }
});

export default router;
