ALTER TABLE uploads ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE INDEX IF NOT EXISTS uploads_project_idx ON uploads (project_id, created_at);
CREATE INDEX IF NOT EXISTS uploads_workspace_project_idx ON uploads (workspace_id, project_id, uploaded_by, created_at);
