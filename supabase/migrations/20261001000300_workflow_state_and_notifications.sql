CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

-- Allow the 'cancelled' event type so cancellation is recorded in the audit trail.
ALTER TABLE workflow_events DROP CONSTRAINT IF EXISTS workflow_events_event_type_check;
ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_event_type_check
  CHECK (event_type IN ('created','advanced','completed','returned','note','cancelled'));

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
