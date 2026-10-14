import { pgTable, uuid, timestamp, vector, text } from "drizzle-orm/pg-core";

export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  memoryId: uuid("memory_id").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  embeddingModel: text("embedding_model").notNull().default("legacy"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
