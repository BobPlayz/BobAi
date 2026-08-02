import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id"),

  userId: uuid("user_id"),

  sessionId: uuid("session_id"),

  action: text("action").notNull(),

  resourceType: text("resource_type").notNull(),

  resourceId: uuid("resource_id"),

  oldValue: jsonb("old_value"),

  newValue: jsonb("new_value"),

  ipAddress: text("ip_address"),

  userAgent: text("user_agent"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull()
});