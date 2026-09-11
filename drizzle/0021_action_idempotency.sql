CREATE TABLE IF NOT EXISTS action_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  action text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  status_code integer,
  response jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS action_idempotency_user_workspace_action_key_unique ON action_idempotency (user_id, workspace_id, action, key);
CREATE INDEX IF NOT EXISTS action_idempotency_expires_idx ON action_idempotency (expires_at);
