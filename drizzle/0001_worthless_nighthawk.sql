CREATE TABLE "action_idempotency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"action" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"step_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
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
--> statement-breakpoint
CREATE TABLE "memory_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"kind" text NOT NULL,
	"tool_id" text,
	"server_id" text,
	"target_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tool_approvals_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"started_by" uuid,
	"status" text NOT NULL,
	"input" jsonb,
	"steps" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"sources" jsonb NOT NULL,
	"answer" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"source_indexes" jsonb NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"contradiction" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_quotas" (
	"user_id" uuid NOT NULL,
	"window_start" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_quotas_user_id_window_start_pk" PRIMARY KEY("user_id","window_start")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier_hash" text,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_hash_unique" UNIQUE("state_hash")
);
--> statement-breakpoint
CREATE TABLE "mfa_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "research_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"options" jsonb,
	"interval_ms" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"last_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "family_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_idempotency_user_workspace_action_key_unique" ON "action_idempotency" USING btree ("user_id","workspace_id","action","key");--> statement-breakpoint
CREATE INDEX "action_idempotency_expires_idx" ON "action_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "agent_artifacts_task_idx" ON "agent_artifacts" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_artifacts_workspace_idx" ON "agent_artifacts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "memory_history_memory_created_idx" ON "memory_history" USING btree ("memory_id","created_at");--> statement-breakpoint
CREATE INDEX "memory_history_workspace_created_idx" ON "memory_history" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "tool_approvals_user_active_idx" ON "tool_approvals" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_created_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_workspace_created_idx" ON "webhook_deliveries" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "research_sessions_workspace_created_idx" ON "research_sessions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "research_sessions_user_created_idx" ON "research_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "research_claims_session_idx" ON "research_claims" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "research_claims_user_idx" ON "research_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_states_expiry_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_states_user_idx" ON "oauth_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "research_briefs_user_idx" ON "research_briefs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "research_briefs_schedule_idx" ON "research_briefs" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_personal_owner_unique" ON "workspaces" USING btree ("owner_id") WHERE "workspaces"."type" = 'personal';--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_refresh_family_idx" ON "sessions" USING btree ("family_id");