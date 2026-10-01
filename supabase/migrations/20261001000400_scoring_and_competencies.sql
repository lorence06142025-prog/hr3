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

-- Seed role-relevant freight and logistics competency baselines.
DELETE FROM competency_assessments
WHERE source = 'baseline';

INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT
  e.id,
  c.competency,
  GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_points)::int)),
  c.required_score,
  'baseline'
FROM employees e
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    ('Fleet & Transportation', 'Defensive Driving', 92, -8),
    ('Fleet & Transportation', 'Vehicle Inspection & Preventive Checks', 90, -6),
    ('Fleet & Transportation', 'Route Compliance', 88, -10),
    ('Fleet & Transportation', 'Cargo Securement', 92, -5),
    ('Fleet & Transportation', 'Fuel-Efficient Operations', 82, 2),
    ('Dispatch & Routing', 'Route Planning & Optimization', 92, -8),
    ('Dispatch & Routing', 'Load Scheduling', 88, -6),
    ('Dispatch & Routing', 'Dispatch Communication', 90, -10),
    ('Dispatch & Routing', 'TMS & GPS Proficiency', 88, -5),
    ('Dispatch & Routing', 'Exception Management', 85, 2),
    ('Warehouse & Inventory', 'Inventory Accuracy', 95, -10),
    ('Warehouse & Inventory', 'Picking & Packing', 90, -6),
    ('Warehouse & Inventory', 'Forklift Operation & Safety', 95, -8),
    ('Warehouse & Inventory', 'Warehouse Safety', 92, 2),
    ('Warehouse & Inventory', 'WMS Proficiency', 85, -4),
    ('Customer Service', 'Shipment Tracking', 90, -7),
    ('Customer Service', 'Customer Communication', 90, -8),
    ('Customer Service', 'Claims Resolution', 88, -5),
    ('Customer Service', 'Proof-of-Delivery Accuracy', 90, 2),
    ('Customer Service', 'Service Recovery', 85, -4),
    ('Safety & Compliance', 'Regulatory Compliance', 95, -8),
    ('Safety & Compliance', 'Incident Reporting', 92, -6),
    ('Safety & Compliance', 'Risk Assessment', 90, -7),
    ('Safety & Compliance', 'Driver Coaching', 88, 2),
    ('Safety & Compliance', 'Emergency Response', 90, -4),
    ('Human Resources', 'Employee Relations', 88, -7),
    ('Human Resources', 'Recruitment & Selection', 88, -8),
    ('Human Resources', 'Labor Compliance', 92, -5),
    ('Human Resources', 'Communication', 85, 2),
    ('Human Resources', 'Leadership', 82, -4),
    ('Executive Office', 'Operational Management', 95, -8),
    ('Executive Office', 'Leadership', 95, -6),
    ('Executive Office', 'Financial Acumen', 90, -7),
    ('Executive Office', 'Strategic Planning', 92, 2),
    ('Executive Office', 'Data-Driven Decision Making', 88, -4),
    ('Finance & Administration', 'Freight Billing & Audit', 92, -7),
    ('Finance & Administration', 'Accounts Reconciliation', 90, -8),
    ('Finance & Administration', 'Payroll Accuracy', 90, -5),
    ('Finance & Administration', 'Internal Controls', 92, 2),
    ('Finance & Administration', 'Documentation Accuracy', 88, -4)
  ) AS competencies(department, competency, required_score, offset_points)
  WHERE competencies.department = e.department
) c
ON CONFLICT (employee_id, competency) DO NOTHING;
