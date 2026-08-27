CREATE TABLE IF NOT EXISTS "email_otps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_otps_user_id_idx" ON "email_otps" ("user_id");
CREATE INDEX IF NOT EXISTS "email_otps_expires_at_idx" ON "email_otps" ("expires_at");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
