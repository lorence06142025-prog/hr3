-- 014_ai_report_integration.sql
-- Persist AI-generated reports so they become part of the workflow audit trail
-- and remain viewable after a workflow is completed.

-- 1. AI reports table. Structured columns keep reports reusable across model
--    changes and allow future re-generation without losing historical data.
CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('performance','competency','learning','training','succession','recognition','executive')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope TEXT NOT NULL DEFAULT 'organization-wide' CHECK (scope IN ('organization-wide','employee','department')),
  employee_id UUID REFERENCES employees(id),
  generated_by_model TEXT,
  model_version TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_reports_workflow_idx ON ai_reports(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_reports_module_idx ON ai_reports(module, created_at DESC);

-- 2. Allow 'ai_report' as a workflow event type so saving a report is recorded
--    as part of the audit trail.
ALTER TABLE workflow_events DROP CONSTRAINT IF EXISTS workflow_events_event_type_check;
ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_event_type_check
  CHECK (event_type IN ('created','advanced','completed','returned','note','cancelled','ai_report'));

-- 3. Optional link from a workflow event to the saved AI report.
ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS ai_report_id UUID REFERENCES ai_reports(id);
