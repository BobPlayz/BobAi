import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const toolApprovals = pgTable("tool_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  workspaceId: uuid("workspace_id"),
  kind: text("kind").notNull(),
  toolId: text("tool_id"),
  serverId: text("server_id"),
  targetName: text("target_name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userActiveIdx: index("tool_approvals_user_active_idx").on(table.userId, table.expiresAt),
}));
