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

-- 020_competency_assessments.sql
-- Per-competency assessment / skill-gap table.
--
-- Purpose: connect competency gaps to learning resources. Before this
-- migration, the system only had an aggregate `employees.competency_score`.
-- This adds a per-competency breakdown (current score vs required score) so
-- the system can:
--   - detect a real SKILL GAP per competency (current < required),
--   - recommend learning resources that close that specific gap,
--   - and record COMPETENCY IMPROVEMENT when an assigned learning path is
--     completed and verified.

CREATE TABLE IF NOT EXISTS competency_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  competency TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  required_score NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (required_score BETWEEN 0 AND 100),
  -- 'baseline'          = seeded from aggregate employee score at migration time
  -- 'assessment'        = set via a competency workflow assessment stage
  -- 'learning_completion' = auto-updated when a gap-linked learning path is verified complete
  -- 'manual'            = HR override entered directly
  source TEXT NOT NULL DEFAULT 'assessment'
    CHECK (source IN ('assessment', 'learning_completion', 'baseline', 'manual')),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, competency)
);
CREATE INDEX IF NOT EXISTS competency_assessments_emp_idx ON competency_assessments(employee_id);
CREATE INDEX IF NOT EXISTS competency_assessments_comp_idx ON competency_assessments(competency);

-- Auto-update updated_at on any change to a competency_assessments row.
CREATE OR REPLACE FUNCTION set_competency_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_competency_updated_at ON competency_assessments;
CREATE TRIGGER trg_competency_updated_at
  BEFORE UPDATE ON competency_assessments
  FOR EACH ROW EXECUTE FUNCTION set_competency_updated_at();

-- ============================================================

-- 026_role_based_competency_reseed.sql
-- Reseed baseline competency assessments by department and role so employees have role-specific competencies and gaps.

-- Delete generic baseline assessments to clean up legacy cross-department contamination
DELETE FROM competency_assessments
WHERE source = 'baseline';

-- 1. Front Office
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Customer Service', 90, -8),
    ('Communication', 88, -6),
    ('Reservation Management', 88, -10),
    ('Conflict Resolution', 80, -5),
    ('Hospitality SOP Compliance', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Front Office'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 2. Kitchen
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Line Expediting & Speed', 90, -8),
    ('Recipe Consistency & Flavor', 90, -6),
    ('HACCP & Kitchen Sanitation', 95, -12),
    ('Food Safety', 90, -5),
    ('Prep & Station Inventory', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Kitchen'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 3. Food & Beverage
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Floor Operations & Speed', 90, -8),
    ('Customer Service', 90, -7),
    ('POS & Cash Reconciliation', 85, -5),
    ('Hygiene & Health Standards', 88, -9),
    ('Team Collaboration', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Food & Beverage'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 4. Housekeeping
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Room Standards & Inspection', 95, -10),
    ('Chemical & Bio-Safety Compliance', 90, -6),
    ('Turnaround Time Optimization', 85, -8),
    ('Linen & Inventory Management', 85, 2),
    ('Hospitality SOP Compliance', 85, -4)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Housekeeping'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 5. Human Resources
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Employee Relations', 88, -7),
    ('Recruitment', 88, -8),
    ('Compliance', 88, -5),
    ('Communication', 80, 2),
    ('Leadership', 80, -4)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Human Resources'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 6. Other departments (Executive Office, General, etc.)
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Operational Management', 95, -8),
    ('Leadership', 95, -6),
    ('Financial Acumen', 88, -7),
    ('Customer Service', 88, 2),
    ('Communication', 88, -4)
) AS c(comp, req, offset_pct)
WHERE e.department NOT IN ('Front Office', 'Kitchen', 'Food & Beverage', 'Housekeeping', 'Human Resources')
ON CONFLICT (employee_id, competency) DO NOTHING;
