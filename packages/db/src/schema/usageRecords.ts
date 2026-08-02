import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb
} from "drizzle-orm/pg-core";

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  organizationId: uuid("organization_id"),

  userId: uuid("user_id"),

  conversationId: uuid("conversation_id"),

  messageId: uuid("message_id"),

  taskId: uuid("task_id"),

  resourceType: text("resource_type").notNull(),

  provider: text("provider"),

  model: text("model"),

  inputTokens: integer("input_tokens"),

  outputTokens: integer("output_tokens"),

  imageCount: integer("image_count"),

  audioSeconds: integer("audio_seconds"),

  requestCount: integer("request_count").notNull().default(1),

  costMicros: integer("cost_micros"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull()
});