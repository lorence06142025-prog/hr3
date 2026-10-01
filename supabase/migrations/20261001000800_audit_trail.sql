-- 021_activity_logs.sql
-- Unified audit & trail (activity log) table.
--
-- Purpose: capture a general-purpose, role-aware audit trail across ALL
-- modules and RBAC accounts/roles. This is separate from the essential
-- workflow_events table (which tracks workflow lifecycle specifically).
-- activity_logs records WHO did WHAT, WHEN, and from WHERE across every
-- module: authentication, employees, certificates, learning, workflows, etc.
--
-- The existing workflow_events table is intentionally left untouched so both
-- trail sources coexist: workflow_events = workflow lifecycle, activity_logs
-- = system-wide activity trail.

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who performed the action (nullable for public/system actions like login
  -- attempts that fail before a user is resolved).
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role user_role,
  actor_name TEXT,
  -- What happened. action is a short machine-readable key (e.g. 'login',
  -- 'employee.create', 'certificate.issue', 'workflow.advance').
  action TEXT NOT NULL,
  -- Broad grouping for filtering: 'auth','employee','certificate','learning',
  -- 'workflow','notification','system'.
  category TEXT NOT NULL,
  -- The affected entity (e.g. employee id, workflow id, resource id).
  target_id TEXT,
  -- Human-readable summary of the action (e.g. 'Created employee John Doe').
  description TEXT,
  -- Structured JSONB payload with extra context (changed fields, request body
  -- summary, etc.). Kept generic so future modules can log rich detail.
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Request metadata.
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_logs_actor_idx ON activity_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_category_idx ON activity_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_target_idx ON activity_logs(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs(created_at DESC);
