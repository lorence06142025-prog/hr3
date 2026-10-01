-- 016_workflow_due_date.sql
-- The create-workflow route (POST /api/workflows) inserts into a `due_date`
-- column, and the `/api/workflows/:id/due-date` + `/api/workflows/overdue`
-- routes reference it. The base workflows table (migration 001) never defined
-- `due_date`, so creating a new cycle threw
--   "column workflows.due_date does not exist"
-- which surfaced as the generic "Something went wrong. Please try again."
--
-- This migration adds the missing column (idempotently) and an index for the
-- overdue query.

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS workflows_due_date_idx ON workflows(due_date);
