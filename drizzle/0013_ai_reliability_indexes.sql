CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS "memory_embeddings_vector_idx"
  ON "memory_embeddings" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "memories_workspace_user_updated_idx"
  ON "memories" ("workspace_id", "user_id", "updated_at")
  WHERE "deleted_at" IS NULL AND "is_archived" = false;

CREATE INDEX IF NOT EXISTS "messages_conversation_status_idx"
  ON "messages" ("conversation_id", "status", "created_at");
