import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { vector } from "pgvector/drizzle-orm";

export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),

  memoryId: uuid("memory_id").notNull(),

  embedding: vector("embedding", { dimensions: 1536 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull()
});