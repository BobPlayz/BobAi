import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),

  agentId: uuid("agent_id").notNull(),

  workspaceId: uuid("workspace_id").notNull(),

  taskId: uuid("task_id"),

  conversationId: uuid("conversation_id"),

  triggerType: text("trigger_type").notNull(),

  status: text("status").notNull(),

  input: jsonb("input"),

  plan: jsonb("plan"),

  output: jsonb("output"),

  error: text("error"),

  model: text("model"),

  tokenCount: integer("token_count"),

  durationMs: integer("duration_ms"),

  metadata: jsonb("metadata"),

  startedAt: timestamp("started_at"),

  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull()
});