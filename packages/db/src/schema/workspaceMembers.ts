import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  userId: uuid("user_id").notNull(),

  role: text("role").notNull().default("member"),

  permissions: jsonb("permissions"),

  invitedBy: uuid("invited_by"),

  joinedAt: timestamp("joined_at").defaultNow().notNull(),

  lastActiveAt: timestamp("last_active_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});