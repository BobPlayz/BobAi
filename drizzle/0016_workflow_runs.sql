CREATE TABLE IF NOT EXISTS "workflow_runs" (
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
CREATE INDEX IF NOT EXISTS "workflow_runs_workspace_started_idx" ON "workflow_runs" ("workspace_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_started_idx" ON "workflow_runs" ("workflow_id", "started_at");
