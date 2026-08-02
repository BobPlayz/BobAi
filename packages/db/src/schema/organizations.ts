import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),

  ownerId: uuid("owner_id").notNull(),

  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  description: text("description"),

  logoUrl: text("logo_url"),

  website: text("website"),

  settings: jsonb("settings"),

  metadata: jsonb("metadata"),

  billingEmail: text("billing_email"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});