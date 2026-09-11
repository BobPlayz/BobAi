import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const researchSessions = pgTable("research_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id").notNull(),
  query: text("query").notNull(),
  sources: jsonb("sources").notNull(),
  answer: text("answer"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({ workspaceCreatedIdx: index("research_sessions_workspace_created_idx").on(table.workspaceId, table.createdAt), userCreatedIdx: index("research_sessions_user_created_idx").on(table.userId, table.createdAt) }));
