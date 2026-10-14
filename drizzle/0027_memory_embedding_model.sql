ALTER TABLE "memory_embeddings" ADD COLUMN IF NOT EXISTS "embedding_model" text NOT NULL DEFAULT 'legacy';
CREATE INDEX IF NOT EXISTS "memory_embeddings_model_memory_idx" ON "memory_embeddings" ("embedding_model", "memory_id");
