CREATE TABLE IF NOT EXISTS "mfa_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "attempts" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mfa_challenges_user_idx" ON "mfa_challenges" ("user_id");
CREATE INDEX IF NOT EXISTS "mfa_challenges_expiry_idx" ON "mfa_challenges" ("expires_at");
