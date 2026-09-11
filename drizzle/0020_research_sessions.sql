CREATE TABLE IF NOT EXISTS research_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  query text NOT NULL,
  sources jsonb NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_sessions_workspace_created_idx ON research_sessions (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS research_sessions_user_created_idx ON research_sessions (user_id, created_at);
