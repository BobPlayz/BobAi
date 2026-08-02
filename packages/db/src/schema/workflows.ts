import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  createdBy: uuid("created_by"),

  name: text("name").notNull(),

  description: text("description"),

  triggerType: text("trigger_type").notNull(),

  triggerConfig: jsonb("trigger_config"),

  steps: jsonb("steps").notNull(),

  variables: jsonb("variables"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  lastRunAt: timestamp("last_run_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});