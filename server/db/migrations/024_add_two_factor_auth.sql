-- 024_add_two_factor_auth.sql
-- Two-Factor Authentication (TOTP / Google Authenticator) support for users.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NULL,
ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT NULL,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS users_2fa_enabled_idx ON users(two_factor_enabled) WHERE two_factor_enabled = true;
