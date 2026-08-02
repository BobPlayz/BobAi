import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  userId: uuid("user_id").notNull(),

  type: text("type").notNull(),

  title: text("title").notNull(),

  body: text("body"),

  data: jsonb("data"),

  channel: text("channel").notNull().default("in_app"),

  readAt: timestamp("read_at"),

  deliveredAt: timestamp("delivered_at"),

  archivedAt: timestamp("archived_at"),

  isRead: boolean("is_read").notNull().default(false),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});