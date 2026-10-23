import { Router } from "express";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { db, conversations, messages, users } from "@bobai/db";

const router = Router();
const TOKEN = /^[A-Za-z0-9_-]{20,40}$/;
const hits = new Map<string, { startedAt: number; count: number }>();

/** Shared chats: anyone with the link sees a read-only, text-only snapshot of the chat as it was when it was shared. */
router.get("/:token", async (req, res) => {
  const token = String(req.params.token);
  const key = req.ip || "unknown";
  const now = Date.now();
  const bucket = hits.get(key);
  if (!bucket || now - bucket.startedAt > 60_000) hits.set(key, { startedAt: now, count: 1 }); else if (++bucket.count > 60) return res.status(429).json({ error: "slow down a sec" });
  if (hits.size > 10_000) hits.clear();
  if (!TOKEN.test(token)) return res.status(404).json({ error: "this share link doesn't exist" });
  try {
    // Links stop working as soon as the owner deletes their account.
    const [conversation] = await db.select({ id: conversations.id, title: conversations.title, metadata: conversations.metadata }).from(conversations)
      .innerJoin(users, eq(users.id, conversations.userId))
      .where(and(sql`${conversations.metadata}->'share'->>'token' = ${token}`, isNull(users.deletedAt))).limit(1);
    const share = (conversation?.metadata as { share?: { token?: string; sharedAt?: string } } | null)?.share;
    if (!conversation || share?.token !== token || !share.sharedAt) return res.status(404).json({ error: "this share link doesn't exist" });
    const rows = await db.select({ role: messages.role, content: messages.content }).from(messages)
      .where(and(eq(messages.conversationId, conversation.id), isNull(messages.deletedAt), lte(messages.createdAt, new Date(share.sharedAt))))
      .orderBy(asc(messages.createdAt)).limit(200);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.json({ title: conversation.title, sharedAt: share.sharedAt, messages: rows.filter((row) => row.role === "user" || row.role === "assistant").map((row) => ({ role: row.role, content: row.content || "(a picture)" })) });
  } catch { return res.status(503).json({ error: "shared chats aren't available right now" }); }
});

export default router;
