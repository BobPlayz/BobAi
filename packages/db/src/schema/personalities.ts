import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer
} from "drizzle-orm/pg-core";

export const personalities = pgTable("personalities", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  userId: uuid("user_id"),

  name: text("name").notNull(),

  description: text("description"),

  systemPrompt: text("system_prompt").notNull(),

  tone: text("tone").notNull().default("balanced"),

  humor: integer("humor").notNull().default(50),

  verbosity: integer("verbosity").notNull().default(50),

  language: text("language").notNull().default("en"),

  nicknamePreference: text("nickname_preference"),

  behaviorSettings: jsonb("behavior_settings"),

  metadata: jsonb("metadata"),

  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});