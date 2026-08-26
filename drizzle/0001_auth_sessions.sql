ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "access_token_hash" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "access_expires_at" timestamp;
UPDATE "sessions" SET "access_expires_at" = COALESCE("last_used_at", "created_at") + INTERVAL '15 minutes' WHERE "access_expires_at" IS NULL;
ALTER TABLE "sessions" ALTER COLUMN "access_expires_at" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_access_token_hash_unique" ON "sessions" ("access_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_refresh_token_hash_unique" ON "sessions" ("refresh_token_hash");
