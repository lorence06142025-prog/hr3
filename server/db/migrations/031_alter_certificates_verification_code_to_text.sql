-- Migration 031: Convert verification_code column in certificates table from UUID to TEXT
-- Allows human-readable verification codes with format 'V-XXXXXXXX'
ALTER TABLE certificates ALTER COLUMN verification_code TYPE TEXT;
ALTER TABLE certificates ALTER COLUMN verification_code SET DEFAULT ('V-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)));
