import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").defaultRandom().primaryKey(),

  organizationId: uuid("organization_id").notNull(),

  userId: uuid("user_id").notNull(),

  role: text("role").notNull().default("member"),

  permissions: jsonb("permissions"),

  invitedBy: uuid("invited_by"),

  invitedAt: timestamp("invited_at"),

  acceptedAt: timestamp("accepted_at"),

  lastActiveAt: timestamp("last_active_at"),

  isActive: boolean("is_active").notNull().default(true),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});