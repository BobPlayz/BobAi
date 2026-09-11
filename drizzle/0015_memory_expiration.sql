ALTER TABLE "memories" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
CREATE INDEX IF NOT EXISTS "memories_active_expiry_idx" ON "memories" ("workspace_id", "user_id", "expires_at") WHERE "deleted_at" IS NULL AND "is_archived" = false;
