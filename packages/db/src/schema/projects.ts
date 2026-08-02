import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  ownerId: uuid("owner_id").notNull(),

  name: text("name").notNull(),

  description: text("description"),

  color: text("color"),

  icon: text("icon"),

  status: text("status").notNull().default("active"),

  visibility: text("visibility").notNull().default("private"),

  settings: jsonb("settings"),

  metadata: jsonb("metadata"),

  archived: boolean("archived").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});