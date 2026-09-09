ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "family_id" uuid;
UPDATE "sessions" SET "family_id" = gen_random_uuid() WHERE "family_id" IS NULL;
ALTER TABLE "sessions" ALTER COLUMN "family_id" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "sessions_refresh_family_idx" ON "sessions" ("family_id");
