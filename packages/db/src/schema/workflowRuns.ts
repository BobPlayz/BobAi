import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  startedBy: uuid("started_by"),
  status: text("status").notNull(),
  input: jsonb("input"),
  steps: jsonb("steps").notNull(),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
