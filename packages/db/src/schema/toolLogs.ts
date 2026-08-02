import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const toolLogs = pgTable("tool_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  toolId: uuid("tool_id"),

  workspaceId: uuid("workspace_id"),

  userId: uuid("user_id"),

  conversationId: uuid("conversation_id"),

  messageId: uuid("message_id"),

  taskId: uuid("task_id"),

  status: text("status").notNull(),

  input: jsonb("input"),

  output: jsonb("output"),

  error: text("error"),

  durationMs: integer("duration_ms"),

  provider: text("provider"),

  model: text("model"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull()
});