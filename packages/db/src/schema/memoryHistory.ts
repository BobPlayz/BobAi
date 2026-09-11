import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const memoryHistory = pgTable("memory_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  memoryId: uuid("memory_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  memoryCreatedIdx: index("memory_history_memory_created_idx").on(table.memoryId, table.createdAt),
  workspaceCreatedIdx: index("memory_history_workspace_created_idx").on(table.workspaceId, table.createdAt),
}));
