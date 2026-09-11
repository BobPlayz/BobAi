CREATE TABLE IF NOT EXISTS agent_artifacts (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  created_by uuid,
  step_id text NOT NULL,
  kind text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_artifacts_task_idx ON agent_artifacts (task_id, created_at);
CREATE INDEX IF NOT EXISTS agent_artifacts_workspace_idx ON agent_artifacts (workspace_id, created_at);
