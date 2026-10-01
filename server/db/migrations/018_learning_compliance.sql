-- 018_learning_compliance.sql
-- Learning Compliance: Assessment quizzes + Employee completion requests.
--
-- Two additions:
--   1. Courses can carry an optional assessment QUIZ (JSONB) with a pass
--      threshold. HR authors it; employees take it.
--   2. Employees submit a COMPLETION REQUEST when they finish a course. HR
--      approves it to write the REAL completion record (learning_completions)
--      or rejects it with a note. This keeps "completion" verified by HR and
--      never fabricated by AI.

-- ============================================================
-- 1. Quiz + pass threshold on learning resources
--    quiz = JSON array of { question, options[], answerIndex, explanation? }
-- ============================================================
ALTER TABLE learning_resources
  ADD COLUMN IF NOT EXISTS quiz JSONB,
  ADD COLUMN IF NOT EXISTS pass_threshold NUMERIC(5,2) NOT NULL DEFAULT 70
    CHECK (pass_threshold BETWEEN 0 AND 100);

-- ============================================================
-- 2. Completion requests — the candidate record HR reviews.
--    status: pending (awaiting HR) / approved / rejected
--    A partial unique index keeps ONE pending request per employee+course so
--    employees can't spam duplicate pending requests.
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_completion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES learning_assignments(id) ON DELETE SET NULL,
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  -- Quiz result snapshot captured at submission time (best-effort).
  quiz_score NUMERIC(5,2),
  quiz_passed BOOLEAN,
  quiz_total INTEGER,
  quiz_correct INTEGER,
  -- Evidence / self-assessment note the employee provides.
  evidence TEXT,
  notes TEXT,
  -- HR review outcome.
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learning_requests_status_idx ON learning_completion_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_requests_emp_idx ON learning_completion_requests(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS learning_requests_one_pending_idx
  ON learning_completion_requests (resource_id, employee_id)
  WHERE status = 'pending';
