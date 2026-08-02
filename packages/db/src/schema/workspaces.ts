import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("personal"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});