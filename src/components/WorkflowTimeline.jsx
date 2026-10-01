import { Fragment } from 'react'
import { CheckCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Workflow history timeline. Renders a stage-by-stage audit trail derived from
// workflow_events (created / advanced / completed / returned / note / ai_report)
// so users see who did what, when, and what notes they left. The AI report
// status appears inline where an ai_report event exists.
// ---------------------------------------------------------------------------

const EVENT_LABEL = {
  created: 'Workflow started',
  advanced: 'Stage completed',
  completed: 'Workflow completed',
  returned: 'Returned to earlier stage',
  note: 'Note added',
  ai_report: 'AI report generated',
  cancelled: 'Workflow cancelled',
}

const stageOf = label => {
  const map = {
    'Workflow started': 'create',
    'Stage completed': 'advance',
    'Workflow completed': 'complete',
    'Returned to earlier stage': 'return',
    'Note added': 'note',
    'AI report generated': 'ai',
    'Workflow cancelled': 'cancel',
  }
  return map[label] || 'note'
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(value)
  }
}

export default function WorkflowTimeline({ workflow, events = [], currentStageLabel }) {
  const items = events
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(event => ({
      ...event,
      label: EVENT_LABEL[event.event_type] || event.event_type,
    }))

  const aiReports = items.filter(item => item.event_type === 'ai_report')
  const hasAiReport = aiReports.length > 0

  return (
    <section className="workflow-timeline">
      <div className="timeline-head">
        <h3>Workflow history</h3>
        <span className={hasAiReport ? 'timeline-ai generated' : 'timeline-ai'}>{hasAiReport ? <><CheckCircle className="w-3.5 h-3.5 inline mr-1 text-emerald-400" /> AI report on file</> : 'No AI report yet'}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-hint">No activity recorded yet for this workflow.</p>
      ) : (
        <ol className="timeline-list">
          {items.map((event, index) => (
            <li key={event.id || index} className={`timeline-event ${stageOf(event.label)}`}>
              <span className="timeline-dot" />
              <div className="timeline-body">
                <div className="timeline-meta">
                  <b>{event.label}</b>
                  <small>{formatDate(event.created_at)}</small>
                </div>
                {event.stage ? <p className="timeline-stage">Stage: <em>{event.stage.replaceAll('_', ' ')}</em></p> : null}
                {event.actor_name ? <p className="timeline-actor">By: <em>{event.actor_name}</em></p> : null}
                {event.note ? <p className="timeline-note">{event.note}</p> : null}
                {event.event_type === 'ai_report' && event.details?.aiReportId ? (
                  <span className="timeline-ai-badge">AI report #{String(event.details.aiReportId).slice(0, 8)}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {hasAiReport && (
        <div className="timeline-ai-summary">
          <strong>AI Report</strong>
          <span>Generated at <b>{formatDate(aiReports[aiReports.length - 1].created_at)}</b> and saved to this workflow&apos;s audit trail.</span>
        </div>
      )}
      <Fragment>
        {currentStageLabel ? <div className="timeline-current">Currently at: <b>{currentStageLabel}</b></div> : null}
      </Fragment>
    </section>
  )
}

