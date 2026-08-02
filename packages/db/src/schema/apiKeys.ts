import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  createdBy: uuid("created_by").notNull(),

  name: text("name").notNull(),

  hashedKey: text("hashed_key").notNull(),

  prefix: text("prefix").notNull(),

  permissions: jsonb("permissions"),

  metadata: jsonb("metadata"),

  lastUsedAt: timestamp("last_used_at"),

  expiresAt: timestamp("expires_at"),

  revokedAt: timestamp("revoked_at"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});