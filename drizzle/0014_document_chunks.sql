CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "workspace_id" uuid NOT NULL,
  "upload_id" uuid NOT NULL,
  "project_id" uuid,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_upload_index_unique" ON "document_chunks" ("upload_id", "chunk_index");
CREATE INDEX IF NOT EXISTS "document_chunks_workspace_upload_idx" ON "document_chunks" ("workspace_id", "upload_id", "chunk_index");
CREATE INDEX IF NOT EXISTS "document_chunks_project_idx" ON "document_chunks" ("workspace_id", "project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "document_chunks_vector_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
