export type DbConversationMessage = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  status: string;
  createdAt: Date;
};

export type DbConversation = {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  updatedAt: Date;
  messages: DbConversationMessage[];
};

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  return import("@bobai/db");
}

export async function dbListConversations(userId: string, workspaceId: string) {
  const database = await getDb();
  if (!database) return null;
  const { and, asc, desc, eq } = await import("drizzle-orm");
  const { conversations, messages } = database;
  const rows = await database.db.select().from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId)))
    .orderBy(desc(conversations.updatedAt));

  return Promise.all(rows.map(async (conversation) => ({
    ...conversation,
    messages: await database.db.select({ id: messages.id, role: messages.role, content: messages.content, model: messages.model, status: messages.status, createdAt: messages.createdAt })
      .from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt)),
  })));
}

export async function dbGetConversation(id: string, userId: string, workspaceId: string) {
  const database = await getDb();
  if (!database) return null;
  const { and, asc, eq } = await import("drizzle-orm");
  const { conversations, messages } = database;
  const rows = await database.db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId))).limit(1);
  const conversation = rows[0];
  if (!conversation) return null;
  const conversationMessages = await database.db.select({ id: messages.id, role: messages.role, content: messages.content, model: messages.model, status: messages.status, createdAt: messages.createdAt })
    .from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt));
  return { ...conversation, messages: conversationMessages } satisfies DbConversation;
}

export async function dbSaveConversation(input: { id: string; userId: string; workspaceId: string; title: string; messages: Array<{ id?: string; role: string; content: string; model?: string | null; status?: string }> }) {
  const database = await getDb();
  if (!database) return false;
  const { conversations, messages } = database;
  await database.db.insert(conversations).values({ id: input.id, userId: input.userId, workspaceId: input.workspaceId, title: input.title })
    .onConflictDoUpdate({ target: conversations.id, set: { title: input.title, updatedAt: new Date() } });
  for (const message of input.messages) {
    if (!message.id) continue;
    await database.db.insert(messages).values({ id: message.id, conversationId: input.id, role: message.role, content: message.content, model: message.model ?? null, status: message.status ?? "completed" }).onConflictDoNothing();
  }
  return true;
}

export async function dbDeleteConversation(id: string, userId: string, workspaceId: string) {
  const database = await getDb();
  if (!database) return false;
  const { and, eq } = await import("drizzle-orm");
  await database.db.delete(database.conversations).where(and(eq(database.conversations.id, id), eq(database.conversations.userId, userId), eq(database.conversations.workspaceId, workspaceId)));
  return true;
}
