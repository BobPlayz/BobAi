import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean
} from "drizzle-orm/pg-core";

export const voices = pgTable("voices", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").notNull(),

  name: text("name").notNull(),

  provider: text("provider").notNull(),

  voiceId: text("voice_id").notNull(),

  language: text("language").notNull().default("en"),

  gender: text("gender"),

  sampleRate: integer("sample_rate"),

  settings: jsonb("settings"),

  metadata: jsonb("metadata"),

  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});