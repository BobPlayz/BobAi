ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_pinned" boolean NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "reminders_user_time_idx" ON "reminders" ("user_id", "remind_at");
