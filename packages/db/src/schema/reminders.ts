import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  userId: uuid("user_id").notNull(),

  taskId: uuid("task_id"),

  title: text("title").notNull(),

  message: text("message"),

  remindAt: timestamp("remind_at").notNull(),

  timezone: text("timezone").notNull().default("UTC"),

  recurrenceRule: text("recurrence_rule"),

  channels: jsonb("channels"),

  metadata: jsonb("metadata"),

  sentAt: timestamp("sent_at"),

  acknowledgedAt: timestamp("acknowledged_at"),

  isCompleted: boolean("is_completed").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});