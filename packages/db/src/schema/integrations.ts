import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  createdBy: uuid("created_by"),

  provider: text("provider").notNull(),

  accountId: text("account_id"),

  displayName: text("display_name"),

  encryptedCredentials: text("encrypted_credentials"),

  scopes: jsonb("scopes"),

  configuration: jsonb("configuration"),

  metadata: jsonb("metadata"),

  isEnabled: boolean("is_enabled").notNull().default(true),

  lastSyncAt: timestamp("last_sync_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});