CREATE TABLE IF NOT EXISTS memory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  snapshot jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_history_memory_created_idx ON memory_history (memory_id, created_at);
CREATE INDEX IF NOT EXISTS memory_history_workspace_created_idx ON memory_history (workspace_id, created_at);
