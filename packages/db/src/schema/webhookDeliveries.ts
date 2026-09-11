import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  eventId: text("event_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  attempts: text("attempts").notNull().default("0"),
  lastError: text("last_error"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  webhookCreatedIdx: index("webhook_deliveries_webhook_created_idx").on(table.webhookId, table.createdAt),
  workspaceCreatedIdx: index("webhook_deliveries_workspace_created_idx").on(table.workspaceId, table.createdAt),
}));
