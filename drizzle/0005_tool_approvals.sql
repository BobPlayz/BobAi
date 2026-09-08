CREATE TABLE IF NOT EXISTS tool_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  kind text NOT NULL,
  tool_id text,
  server_id text,
  target_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_approvals_user_active_idx
  ON tool_approvals (user_id, expires_at);
