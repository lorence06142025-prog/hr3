-- Allow the 'cancelled' event type so cancellation is recorded in the audit trail.
ALTER TABLE workflow_events DROP CONSTRAINT IF EXISTS workflow_events_event_type_check;
ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_event_type_check
  CHECK (event_type IN ('created','advanced','completed','returned','note','cancelled'));

