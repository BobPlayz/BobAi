CREATE TABLE IF NOT EXISTS research_claims (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  claim text NOT NULL,
  source_indexes jsonb NOT NULL,
  confidence integer NOT NULL DEFAULT 0,
  contradiction text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_claims_session_idx ON research_claims (session_id);
CREATE INDEX IF NOT EXISTS research_claims_user_idx ON research_claims (user_id);
CREATE TABLE IF NOT EXISTS research_quotas (
  user_id uuid NOT NULL,
  window_start timestamp NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  source_count integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_start)
);
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  state_hash text NOT NULL UNIQUE,
  code_verifier_hash text,
  redirect_uri text NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states (expires_at);
CREATE INDEX IF NOT EXISTS oauth_states_user_idx ON oauth_states (user_id);
