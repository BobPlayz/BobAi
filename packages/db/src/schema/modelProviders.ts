import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const modelProviders = pgTable("model_providers", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  createdBy: uuid("created_by"),

  name: text("name").notNull(),

  provider: text("provider").notNull(),

  baseUrl: text("base_url"),

  encryptedApiKey: text("encrypted_api_key"),

  configuration: jsonb("configuration"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});