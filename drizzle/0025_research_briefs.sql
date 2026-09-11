CREATE TABLE IF NOT EXISTS research_briefs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  query text NOT NULL,
  options jsonb,
  interval_ms integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamp,
  next_run_at timestamp,
  last_session_id uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_briefs_user_idx ON research_briefs (user_id, created_at);
CREATE INDEX IF NOT EXISTS research_briefs_schedule_idx ON research_briefs (enabled, next_run_at);
