import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";

export const actionIdempotency = pgTable("action_idempotency", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  action: text("action").notNull(),
  key: text("key").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").notNull().default("processing"),
  statusCode: integer("status_code"),
  response: jsonb("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  actionKeyUnique: uniqueIndex("action_idempotency_user_workspace_action_key_unique").on(table.userId, table.workspaceId, table.action, table.key),
  expiresIdx: index("action_idempotency_expires_idx").on(table.expiresAt),
}));
