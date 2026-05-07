ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users (google_sub);

-- Optional cleanup of old token table
DROP TABLE IF EXISTS email_verification_tokens;
