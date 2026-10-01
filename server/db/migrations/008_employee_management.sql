-- 008_employee_management.sql
-- Normalized departments, score history time-series, and self-service invitations.

-- 1. Departments (normalized)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill departments from existing free-text employee.department values.
INSERT INTO departments (name)
SELECT DISTINCT trim(department) FROM employees
WHERE department IS NOT NULL AND trim(department) <> ''
ON CONFLICT (name) DO NOTHING;

-- Add department_id FK on employees.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Backfill department_id from the department string.
UPDATE employees e
SET department_id = d.id
FROM departments d
WHERE e.department_id IS NULL
  AND e.department IS NOT NULL
  AND trim(e.department) = d.name;

-- 2. Score history time-series
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  competency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  learning_progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS score_history_employee_idx ON score_history(employee_id, recorded_at DESC);

-- Backfill one baseline history row per employee.
INSERT INTO score_history (employee_id, performance_score, competency_score, learning_progress, recorded_at)
SELECT id, performance_score, competency_score, learning_progress, created_at
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM score_history h WHERE h.employee_id = e.id);

-- Snapshot scores whenever an employee row's scores change.
CREATE OR REPLACE FUNCTION snapshot_score_history() RETURNS trigger AS $$
BEGIN
  INSERT INTO score_history(employee_id, performance_score, competency_score, learning_progress)
  VALUES (NEW.id, NEW.performance_score, NEW.competency_score, NEW.learning_progress);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_scores ON employees;
CREATE TRIGGER trg_snapshot_scores
AFTER UPDATE OF performance_score, competency_score, learning_progress ON employees
FOR EACH ROW
WHEN (NEW.performance_score IS DISTINCT FROM OLD.performance_score
   OR NEW.competency_score IS DISTINCT FROM OLD.competency_score
   OR NEW.learning_progress IS DISTINCT FROM OLD.learning_progress)
EXECUTE FUNCTION snapshot_score_history();

-- 3. Self-service registration invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'employee',
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  employee_id UUID REFERENCES employees(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);

