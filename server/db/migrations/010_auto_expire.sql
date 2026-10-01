-- Auto-expire certificates: when a certificate's expires_at passes and it is still
-- marked 'issued', it should become 'expired'.
--
-- NOTE: PostgreSQL does NOT support BEFORE SELECT triggers (that is Oracle syntax).
-- The trigger fires only on INSERT/UPDATE/DELETE/TRUNCATE, so it cannot be used to
-- refresh statuses "just in time" for a read. Instead, this function is invoked:
--   1. automatically from the certificates GET / route before listing, and
--   2. manually from the POST /api/certificates/check-expiry endpoint (HR button).

CREATE OR REPLACE FUNCTION expire_certificates()
RETURNS void AS $$
BEGIN
  UPDATE certificates
  SET status = 'expired',
      metadata = metadata || jsonb_build_object('expiredAt', NOW()::text)
  WHERE status = 'issued'
    AND expires_at IS NOT NULL
    AND expires_at < NOW()::date;
END;
$$ LANGUAGE plpgsql;


