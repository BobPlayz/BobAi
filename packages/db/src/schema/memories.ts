import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb
} from "drizzle-orm/pg-core";

export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  userId: uuid("user_id"),

  projectId: uuid("project_id"),

  type: text("type").notNull().default("user"),

  category: text("category").notNull().default("preference"),

  content: text("content").notNull(),

  summary: text("summary"),

  confidence: integer("confidence").notNull().default(100),

  importance: integer("importance").notNull().default(50),

  isPinned: boolean("is_pinned").notNull().default(false),

  isArchived: boolean("is_archived").notNull().default(false),

  sourceMessageId: uuid("source_message_id"),

  sourceConversationId: uuid("source_conversation_id"),

  sourceType: text("source_type").notNull().default("chat"),

  metadata: jsonb("metadata"),

  lastAccessedAt: timestamp("last_accessed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});