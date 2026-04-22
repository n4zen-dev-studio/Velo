CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  password_hash TEXT,
  username TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_auth_codes_email_purpose ON auth_codes (email, purpose);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes (email);
CREATE INDEX IF NOT EXISTS idx_auth_codes_purpose_expires_at ON auth_codes (purpose, expires_at);
