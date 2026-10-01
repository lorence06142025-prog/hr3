CREATE TABLE certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  certificate_title TEXT NOT NULL,
  subtitle TEXT,
  organization_name TEXT NOT NULL,
  body_text TEXT NOT NULL,
  logo_url TEXT,
  signatory_name TEXT NOT NULL,
  signatory_position TEXT,
  signature_url TEXT,
  background_url TEXT,
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES certificate_templates(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  achievement_text TEXT NOT NULL,
  awarded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked', 'expired')),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  issued_by UUID NOT NULL REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX certificates_employee_idx ON certificates(employee_id, issued_at DESC);
CREATE INDEX certificates_status_idx ON certificates(status, issued_at DESC);
