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
-- Baseline seed: derive per-competency scores from the demo
-- employees' aggregate competency_score, with required targets set
-- by role so the workflow has real, meaningful gaps to act on.
-- Uses a deterministic offset so the same competency isn't always
-- the same value. Only seeds rows that don't already exist.
--
-- For maximum PostgreSQL compatibility, the competency list is
-- loaded into a TEMPORARY table using plain INSERT ... VALUES, then
-- joined from a real table. This avoids the VALUES-subquery parser
-- edge cases that can break on some PostgreSQL versions.
-- ============================================================
CREATE TEMP TABLE _seed_competencies (
  competency      TEXT    NOT NULL,
  required_score  NUMERIC NOT NULL,
  offset_pct      INT     NOT NULL
) ON COMMIT DROP;

INSERT INTO _seed_competencies (competency, required_score, offset_pct) VALUES
  ('Customer Service',       90, -1),
  ('Communication',          85,  1),
  ('Leadership',             80, -2),
  ('Food Safety',            85,  1),
  ('Kitchen Operations',     80, -2),
  ('Compliance',             90, -1),
  ('Conflict Resolution',    80,  2),
  ('Technical Skills',       75,  1),
  ('Operational Management', 80, -1),
  ('Financial Acumen',       75,  2),
  ('Reservation Management', 80,  1),
  ('Upselling',              75,  2),
  ('Teamwork',               85,  0);

INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT
  e.id,
  c.competency,
  GREATEST(30, LEAST(100,
    round(e.competency_score::numeric + (c.offset_pct::numeric * 10))::int
  ))::numeric AS score,
  c.required_score::numeric,
  'baseline'
FROM employees e
CROSS JOIN _seed_competencies c
WHERE NOT EXISTS (
  SELECT 1 FROM competency_assessments ca
  WHERE ca.employee_id = e.id AND ca.competency = c.competency
);
