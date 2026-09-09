import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, workspaceMembers } from "@bobai/db";
import { requireAuth } from "../middleware/auth.js";
import { dbDeleteConversation, dbGetConversation, dbListConversations, dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
const router = Router(); router.use(requireAuth);
type AuthenticatedRequest = Request & { user: { id: string } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 500;
const MAX_MESSAGE_CONTENT = 100_000;
const MAX_ATTACHMENTS_BYTES = 512_000;
const MAX_CONVERSATION_BYTES = 5 * 1024 * 1024;
async function requireContext(req: AuthenticatedRequest, res: Response) {
  const body = req.body as Record<string, unknown> | undefined;
  const requested = typeof req.query.workspaceId === "string" ? req.query.workspaceId : typeof body?.workspaceId === "string" ? body.workspaceId : "";
  if (!requested) { try { const workspace = await ensurePersonalWorkspace(req.user.id); return { userId: req.user.id, workspaceId: workspace.id }; } catch { res.status(503).json({ error: "personal workspace unavailable" }); return null; } }
  if (!UUID.test(requested)) { res.status(400).json({ error: "invalid workspace context" }); return null; }
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, req.user.id))).limit(1);
  if (!member) { res.status(403).json({ error: "workspace access denied" }); return null; }
  return { userId: req.user.id, workspaceId: requested };
}
function validateConversationPayload(value: Record<string, unknown>) {
  if (typeof value.id !== "string" || !UUID.test(value.id) || typeof value.title !== "string" || !Array.isArray(value.messages)) return "id, title, and messages are required";
  if (value.messages.length > MAX_MESSAGES) return `a conversation may contain at most ${MAX_MESSAGES} messages`;
  let bytes = Buffer.byteLength(value.title, "utf8");
  if (bytes > 800) return "title is too long";
  for (const message of value.messages) {
    if (!message || typeof message !== "object") return "invalid message";
    const item = message as Record<string, unknown>;
    if (typeof item.id !== "string" || !UUID.test(item.id)) return "message ids must be valid UUIDs";
    if (typeof item.role !== "string" || !["user", "assistant", "system"].includes(item.role)) return "invalid message role";
    if (typeof item.content !== "string" || item.content.length > MAX_MESSAGE_CONTENT) return "message content is too large";
    bytes += Buffer.byteLength(item.content, "utf8");
    if (item.attachments !== undefined) {
      let attachmentBytes = 0;
      try { attachmentBytes = Buffer.byteLength(JSON.stringify(item.attachments), "utf8"); } catch { return "invalid attachments"; }
      if (attachmentBytes > MAX_ATTACHMENTS_BYTES) return "message attachments are too large";
      bytes += attachmentBytes;
    }
    if (bytes > MAX_CONVERSATION_BYTES) return "conversation payload is too large";
  }
  return null;
}
router.get("/", async (req, res) => { try { const context = await requireContext(req as AuthenticatedRequest, res); if (!context) return; const conversations = await dbListConversations(context.userId, context.workspaceId); if (!conversations) return res.status(503).json({ error: "persistent storage unavailable" }); return res.json({ conversations, workspaceId: context.workspaceId }); } catch { return res.status(500).json({ error: "failed to list conversations" }); } });
router.get("/:id", async (req, res) => { try { const context = await requireContext(req as AuthenticatedRequest, res); if (!context) return; if (!UUID.test(req.params.id as string)) return res.status(400).json({ error: "invalid conversation id" }); const conversation = await dbGetConversation(req.params.id as string, context.userId, context.workspaceId); if (!conversation) return res.status(404).json({ error: "conversation not found" }); return res.json(conversation); } catch { return res.status(500).json({ error: "failed to get conversation" }); } });
router.post("/", async (req, res) => { const conversation = req.body as Record<string, unknown>; const validationError = validateConversationPayload(conversation); if (validationError) return res.status(400).json({ error: validationError }); try { const context = await requireContext(req as AuthenticatedRequest, res); if (!context) return; const saved = await dbSaveConversation({ id: conversation.id as string, userId: context.userId, workspaceId: context.workspaceId, title: (conversation.title as string).trim().slice(0, 200), messages: conversation.messages as Array<{ id?: string; role: string; content: string; model?: string | null; status?: string; attachments?: unknown }> }); if (!saved) return res.status(503).json({ error: "persistent storage unavailable" }); return res.json({ success: true, persistent: true, workspaceId: context.workspaceId }); } catch { return res.status(500).json({ error: "failed to save conversation" }); } });
router.delete("/:id", async (req, res) => { try { const context = await requireContext(req as AuthenticatedRequest, res); if (!context) return; if (!UUID.test(req.params.id as string)) return res.status(400).json({ error: "invalid conversation id" }); const deleted = await dbDeleteConversation(req.params.id as string, context.userId, context.workspaceId); if (!deleted) return res.status(404).json({ error: "conversation not found" }); return res.json({ success: true, persistent: true }); } catch { return res.status(500).json({ error: "failed to delete conversation" }); } });
export default router;
