import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  projectId: uuid("project_id"),

  createdBy: uuid("created_by"),

  assignedTo: uuid("assigned_to"),

  agentId: uuid("agent_id"),

  title: text("title").notNull(),

  description: text("description"),

  type: text("type").notNull().default("task"),

  status: text("status").notNull().default("pending"),

  priority: integer("priority").notNull().default(50),

  payload: jsonb("payload"),

  result: jsonb("result"),

  metadata: jsonb("metadata"),

  scheduledFor: timestamp("scheduled_for"),

  startedAt: timestamp("started_at"),

  completedAt: timestamp("completed_at"),

  failedAt: timestamp("failed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});