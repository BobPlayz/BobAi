import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  userId: uuid("user_id"),

  key: text("key").notNull(),

  value: jsonb("value").notNull(),

  category: text("category").notNull().default("general"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});