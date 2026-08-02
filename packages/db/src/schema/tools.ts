import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  createdBy: uuid("created_by"),

  name: text("name").notNull(),

  description: text("description"),

  type: text("type").notNull(),

  endpoint: text("endpoint"),

  configuration: jsonb("configuration"),

  permissions: jsonb("permissions"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  isSystem: boolean("is_system").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});