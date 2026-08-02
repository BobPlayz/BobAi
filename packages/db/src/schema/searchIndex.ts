import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";
import { vector } from "pgvector/drizzle-orm";

export const searchIndex = pgTable("search_index", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  resourceType: text("resource_type").notNull(),

  resourceId: uuid("resource_id").notNull(),

  title: text("title"),

  content: text("content").notNull(),

  embedding: vector("embedding", { dimensions: 1536 }).notNull(),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull()
});