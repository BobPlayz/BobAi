import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  parentMessageId: uuid("parent_message_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  status: text("status").notNull().default("completed"),
  isEdited: boolean("is_edited").notNull().default(false),
  editedFrom: uuid("edited_from"),
  regenerationIndex: integer("regeneration_index").notNull().default(0),
  toolCalls: jsonb("tool_calls"),
  toolResults: jsonb("tool_results"),
  attachments: jsonb("attachments"),
  metadata: jsonb("metadata"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at")
}, (table) => ({ conversationCreatedIdx: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt) }));
