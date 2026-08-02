import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),

  organizationId: uuid("organization_id"),

  workspaceId: uuid("workspace_id"),

  billingPlanId: uuid("billing_plan_id").notNull(),

  provider: text("provider").notNull().default("stripe"),

  providerSubscriptionId: text("provider_subscription_id"),

  status: text("status").notNull().default("active"),

  billingCycle: text("billing_cycle").notNull().default("monthly"),

  currency: text("currency").notNull().default("USD"),

  metadata: jsonb("metadata"),

  trialEndsAt: timestamp("trial_ends_at"),

  currentPeriodStart: timestamp("current_period_start"),

  currentPeriodEnd: timestamp("current_period_end"),

  canceledAt: timestamp("canceled_at"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});