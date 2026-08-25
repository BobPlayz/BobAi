import { and, asc, desc, eq } from "drizzle-orm";
import { conversations, messages } from "@bobai/db";
import { db } from "@bobai/db";

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

export async function dbListConversations(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId)))
    .orderBy(desc(conversations.updatedAt));

  return Promise.all(rows.map(async (conversation) => ({
    ...conversation,
    messages: await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        model: messages.model,
        status: messages.status,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt)),
  })));
}

export async function dbGetConversation(id: string, userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId)))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) return null;

  const conversationMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      model: messages.model,
      status: messages.status,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  return { ...conversation, messages: conversationMessages } satisfies DbConversation;
}

export async function dbSaveConversation(input: {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  messages: Array<{ id?: string; role: string; content: string; model?: string | null; status?: string }>;
}) {
  await db.insert(conversations).values({
    id: input.id,
    userId: input.userId,
    workspaceId: input.workspaceId,
    title: input.title,
  }).onConflictDoUpdate({
    target: conversations.id,
    set: { title: input.title, updatedAt: new Date() },
  });

  for (const message of input.messages) {
    if (!message.id) continue;
    await db.insert(messages).values({
      id: message.id,
      conversationId: input.id,
      role: message.role,
      content: message.content,
      model: message.model ?? null,
      status: message.status ?? "completed",
    }).onConflictDoNothing();
  }
}

export async function dbDeleteConversation(id: string, userId: string, workspaceId: string) {
  await db.delete(conversations).where(
    and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.workspaceId, workspaceId)),
  );
}
