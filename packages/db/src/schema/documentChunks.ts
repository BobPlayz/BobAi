import { pgTable, uuid, text, integer, timestamp, jsonb, vector } from "drizzle-orm/pg-core";

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  uploadId: uuid("upload_id").notNull(),
  projectId: uuid("project_id"),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
