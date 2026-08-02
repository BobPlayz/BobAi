import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const billingPlans = pgTable("billing_plans", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  description: text("description"),

  monthlyPriceCents: integer("monthly_price_cents").notNull(),

  yearlyPriceCents: integer("yearly_price_cents"),

  limits: jsonb("limits").notNull(),

  features: jsonb("features").notNull(),

  metadata: jsonb("metadata"),

  isPublic: boolean("is_public").notNull().default(true),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});