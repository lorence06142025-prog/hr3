-- 019_learning_status.sql
-- Self-reported study progress + status.
--
-- Replaces the quiz + completion-request flow with a simpler, employee-driven
-- model:
--   - Employees update their own study PROGRESS % per assigned course (slider).
--   - Employees set a STATUS: Not started / Studying / Completed / Need help.
--   - HR/supervisors see a LIVE status badge on every assignment so they know
--     whether a course is being studied, stuck, or overdue.
--   - HR still officially VERIFIES/RECORDS completion in learning_completions
--     (the single source of truth) via the existing /completions endpoint.

-- ============================================================
-- 1. Remove the quiz-based compliance flow (Option 2/3) entirely.
-- ============================================================
DROP TABLE IF EXISTS learning_completion_requests;

-- Remove quiz + pass threshold from learning_resources (fully removed).
ALTER TABLE learning_resources
  DROP COLUMN IF EXISTS quiz,
  DROP COLUMN IF EXISTS pass_threshold;

-- ============================================================
-- 2. Rebuild learning_assignments.status to support self-reported
--    statuses. The status becomes the employee's self-reported flag
--    (not a progress-computed value), while `progress` (0-100) remains
--    the employee-driven slider.
--    Values: not_started / studying / completed / need_help
-- ============================================================
ALTER TABLE learning_assignments DROP CONSTRAINT IF EXISTS learning_assignments_status_check;

-- Existing rows: map old statuses to the new vocabulary BEFORE adding the
-- new CHECK constraint (otherwise the constraint is violated by old values
-- such as 'assigned' / 'in_progress').
UPDATE learning_assignments
  SET status = CASE
    WHEN status = 'assigned'    THEN 'not_started'
    WHEN status = 'in_progress' THEN 'studying'
    WHEN status = 'completed'   THEN 'completed'
    ELSE 'not_started'
  END
  WHERE status NOT IN ('not_started','studying','completed','need_help');

ALTER TABLE learning_assignments
  ADD CONSTRAINT learning_assignments_status_check
  CHECK (status IN ('not_started','studying','completed','need_help'));

-- Default a new assignment to 'not_started' (self-reported start point).
ALTER TABLE learning_assignments ALTER COLUMN status SET DEFAULT 'not_started';

