import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  createdBy: uuid("created_by"),

  personalityId: uuid("personality_id"),

  name: text("name").notNull(),

  description: text("description"),

  systemPrompt: text("system_prompt").notNull(),

  model: text("model").notNull().default("gpt-5.5"),

  status: text("status").notNull().default("idle"),

  toolIds: jsonb("tool_ids"),

  memoryScope: text("memory_scope").notNull().default("workspace"),

  autonomyLevel: integer("autonomy_level").notNull().default(50),

  configuration: jsonb("configuration"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  lastRunAt: timestamp("last_run_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});