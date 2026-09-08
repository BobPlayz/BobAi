CREATE UNIQUE INDEX IF NOT EXISTS workspaces_personal_owner_unique
  ON workspaces (owner_id)
  WHERE type = 'personal';
