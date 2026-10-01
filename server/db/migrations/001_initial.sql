CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('employee', 'supervisor', 'management', 'hr');
CREATE TYPE workflow_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  manager_id UUID REFERENCES employees(id),
  performance_score NUMERIC(5,2) DEFAULT 0 CHECK (performance_score BETWEEN 0 AND 100),
  competency_score NUMERIC(5,2) DEFAULT 0 CHECK (competency_score BETWEEN 0 AND 100),
  learning_progress NUMERIC(5,2) DEFAULT 0 CHECK (learning_progress BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID UNIQUE REFERENCES employees(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL CHECK (module IN ('performance','competency','learning','training','succession','recognition')),
  title TEXT NOT NULL,
  subject_employee_id UUID REFERENCES employees(id),
  current_stage TEXT NOT NULL,
  status workflow_status NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workflows_active_idx ON workflows(module, status, updated_at DESC);
CREATE INDEX workflows_subject_idx ON workflows(subject_employee_id, status);

CREATE TABLE workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','advanced','completed','returned','note')),
  actor_id UUID NOT NULL REFERENCES users(id),
  note TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workflow_events_history_idx ON workflow_events(workflow_id, created_at);

CREATE TABLE succession_profiles (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  readiness_band TEXT NOT NULL DEFAULT 'development_needed' CHECK (readiness_band IN ('ready_now','ready_in_1_2_years','development_needed')),
  target_role TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
