import { pgTable, uuid, timestamp, vector } from "drizzle-orm/pg-core";

export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  memoryId: uuid("memory_id").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
