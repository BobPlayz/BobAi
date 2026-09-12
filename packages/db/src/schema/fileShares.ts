import { index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const fileShares = pgTable("file_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileId: uuid("file_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  sharedWithUserId: uuid("shared_with_user_id").notNull(),
  permission: text("permission").notNull().default("read"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  targetUnique: uniqueIndex("file_shares_file_user_unique").on(table.fileId, table.sharedWithUserId),
  fileIdx: index("file_shares_file_idx").on(table.fileId),
  userIdx: index("file_shares_user_idx").on(table.sharedWithUserId),
}));
