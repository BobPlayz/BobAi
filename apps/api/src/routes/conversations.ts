import { Router } from "express";
import { listConversations, getConversation, saveConversation, deleteConversation } from "../store/conversations.js";
import { dbDeleteConversation, dbGetConversation, dbListConversations, dbSaveConversation } from "../store/conversationDb.js";

const router = Router();

function dbContext(req: { query: Record<string, unknown>; body?: unknown }) {
  const body = req.body as Record<string, unknown> | undefined;
  const userId = typeof req.query.userId === "string" ? req.query.userId : typeof body?.userId === "string" ? body.userId : "";
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  return userId && workspaceId ? { userId, workspaceId } : null;
}

router.get("/", async (req, res) => {
  try {
    const context = dbContext(req);
    if (context) {
      const conversations = await dbListConversations(context.userId, context.workspaceId);
      if (conversations) return res.json({ conversations });
    }
    return res.json({ conversations: listConversations() });
  } catch (error) {
    console.error("CONVERSATION LIST ERROR:", error);
    return res.status(500).json({ error: "failed to list conversations" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const context = dbContext(req);
    const conversation = context
      ? await dbGetConversation(req.params.id, context.userId, context.workspaceId) || getConversation(req.params.id)
      : getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: "conversation not found" });
    return res.json(conversation);
  } catch (error) {
    console.error("CONVERSATION GET ERROR:", error);
    return res.status(500).json({ error: "failed to get conversation" });
  }
});

router.post("/", async (req, res) => {
  const conversation = req.body as Record<string, unknown>;
  if (typeof conversation?.id !== "string" || typeof conversation?.title !== "string" || !Array.isArray(conversation?.messages)) {
    return res.status(400).json({ error: "id, title, and messages are required" });
  }

  try {
    const context = dbContext(req);
    if (context) {
      const saved = await dbSaveConversation({
        id: conversation.id,
        userId: context.userId,
        workspaceId: context.workspaceId,
        title: conversation.title,
        messages: conversation.messages as Array<{ id?: string; role: string; content: string; model?: string | null; status?: string }>,
      });
      if (saved) return res.json({ success: true, persistent: true });
    }

    saveConversation({ ...conversation, updatedAt: Date.now() } as never);
    return res.json({ success: true, persistent: false });
  } catch (error) {
    console.error("CONVERSATION SAVE ERROR:", error);
    return res.status(500).json({ error: "failed to save conversation" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const context = dbContext(req);
    if (context) {
      const deleted = await dbDeleteConversation(req.params.id, context.userId, context.workspaceId);
      if (deleted) return res.json({ success: true, persistent: true });
    }
    deleteConversation(req.params.id);
    return res.json({ success: true, persistent: false });
  } catch (error) {
    console.error("CONVERSATION DELETE ERROR:", error);
    return res.status(500).json({ error: "failed to delete conversation" });
  }
});

export default router;
