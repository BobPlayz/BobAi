import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  createdBy: uuid("created_by"),

  name: text("name").notNull(),

  url: text("url").notNull(),

  secret: text("secret"),

  events: jsonb("events").notNull(),

  headers: jsonb("headers"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  lastTriggeredAt: timestamp("last_triggered_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});