import { and, asc, desc, eq, sql } from "drizzle-orm";

export type DbConversationMessage = { id: string; role: string; content: string; model: string | null; status: string; attachments: unknown; createdAt: Date };
export type DbConversation = { id: string; workspaceId: string; userId: string; title: string; updatedAt: Date; messages: DbConversationMessage[]; isPinned?: boolean; isArchived?: boolean };
async function getDb() { if (!process.env.DATABASE_URL) return null; return import("@bobai/db"); }

export async function dbListConversations(userId: string, workspaceId: string, includeArchived = false, limit = 50, cursor?: string) {
  const database = await getDb(); if (!database) return null;
  const { conversations, messages } = database;
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const where = includeArchived ? and(eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId)) : and(eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId), eq(conversations.isArchived, false));
  const rows = await database.db.select().from(conversations).where(where).orderBy(desc(conversations.updatedAt), desc(conversations.id)).limit(safeLimit + 1);
  const visible = cursor ? rows.filter((row) => row.updatedAt.toISOString() < cursor) : rows;
  const page = visible.slice(0, safeLimit);
  return { items: await Promise.all(page.map(async (conversation) => ({ ...conversation, messages: await database.db.select({ id: messages.id, role: messages.role, content: messages.content, model: messages.model, status: messages.status, attachments: messages.attachments, createdAt: messages.createdAt }).from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt)) }))), nextCursor: visible.length > safeLimit ? page[page.length - 1]?.updatedAt.toISOString() ?? null : null };
}

export async function dbGetConversation(id: string, userId: string, workspaceId: string, messageLimit = 200, before?: string) {
  const database = await getDb(); if (!database) return null; const { conversations, messages } = database;
  const rows = await database.db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId))).limit(1); const conversation = rows[0]; if (!conversation) return null;
  const safeLimit = Math.min(500, Math.max(1, Math.floor(messageLimit)));
  const where = before ? and(eq(messages.conversationId, conversation.id), sql`${messages.createdAt} < ${new Date(before)}`) : eq(messages.conversationId, conversation.id);
  const conversationMessages = await database.db.select({ id: messages.id, role: messages.role, content: messages.content, model: messages.model, status: messages.status, attachments: messages.attachments, createdAt: messages.createdAt }).from(messages).where(where).orderBy(desc(messages.createdAt)).limit(safeLimit);
  conversationMessages.reverse();
  return { ...conversation, messages: conversationMessages } satisfies DbConversation;
}

export async function dbSaveConversation(input: { id: string; userId: string; workspaceId: string; title: string; messages: Array<{ id?: string; role: string; content: string; model?: string | null; status?: string; attachments?: unknown }> }) {
  const database = await getDb(); if (!database) return false; const { conversations, messages } = database;
  await database.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.id}))`);
    const existing = await tx.select({ userId: conversations.userId, workspaceId: conversations.workspaceId }).from(conversations).where(eq(conversations.id, input.id)).limit(1);
    if (existing[0] && (existing[0].userId !== input.userId || existing[0].workspaceId !== input.workspaceId)) throw new Error("conversation ownership mismatch");
    if (existing[0]) await tx.update(conversations).set({ title: input.title, updatedAt: new Date() }).where(eq(conversations.id, input.id));
    else await tx.insert(conversations).values({ id: input.id, userId: input.userId, workspaceId: input.workspaceId, title: input.title });
    for (const message of input.messages) {
      if (!message.id) continue;
      await tx.insert(messages).values({ id: message.id, conversationId: input.id, role: message.role, content: message.content, model: message.model ?? null, status: message.status ?? "completed", attachments: message.attachments ?? null }).onConflictDoUpdate({ target: messages.id, set: { content: message.content, model: message.model ?? null, status: message.status ?? "completed", attachments: message.attachments ?? null, updatedAt: new Date() } });
    }
  }); return true;
}

export async function dbUpdateMessageStatus(input: { conversationId: string; messageId: string; userId: string; workspaceId: string; status: "pending" | "streaming" | "completed" | "failed" | "cancelled"; content?: string; model?: string | null }) {
  const database = await getDb(); if (!database) return false; const { conversations, messages } = database;
  const owner = await database.db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId), eq(conversations.workspaceId, input.workspaceId))).limit(1);
  if (!owner[0]) return false;
  const result = await database.db.update(messages).set({ status: input.status, ...(input.content !== undefined ? { content: input.content } : {}), ...(input.model !== undefined ? { model: input.model } : {}), updatedAt: new Date() }).where(and(eq(messages.id, input.messageId), eq(messages.conversationId, input.conversationId))).returning({ id: messages.id });
  return Boolean(result[0]);
}

export async function dbDeleteConversation(id: string, userId: string, workspaceId: string) {
  const database = await getDb(); if (!database) return false; const result = await database.db.delete(database.conversations).where(and(eq(database.conversations.id, id), eq(database.conversations.userId, userId), eq(database.conversations.workspaceId, workspaceId))).returning({ id: database.conversations.id }); return Boolean(result[0]);
}
