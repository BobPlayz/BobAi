CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamp NOT NULL,
  count integer NOT NULL,
  expires_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_idx ON rate_limit_buckets (expires_at);
