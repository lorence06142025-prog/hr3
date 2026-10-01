import { useMemo } from 'react'
import { computeModuleStats, configFor } from '../workflowConfig'
import AnimatedNumber from './AnimatedNumber'

// ---------------------------------------------------------------------------
// Module-specific dashboard strip. Each module's config defines its own
// widgets (from workflowConfig.js) so the top of every module shows meaningful
// business statistics instead of empty space. Quick actions and pending action
// hints are also surfaced here.
// ---------------------------------------------------------------------------

function Widget({ widget, value }) {
  let display = '0'
  if (widget.type === 'pct') display = `${Number(value || 0)}%`
  else if (widget.type === 'text') display = value || '—'
  else display = String(value ?? 0)
  return (
    <article className="module-widget" title={`${widget.label}: ${display}`}>
      <small>{widget.label}</small>
      <b><AnimatedNumber value={display} /></b>
      <em>Live data</em>
    </article>
  )
}

export default function ModuleDashboard({ moduleKey, data, workflows, quickActions, onQuickAction, role }) {
  const stats = useMemo(function() { return computeModuleStats(moduleKey, data || {}, workflows || []) }, [moduleKey, data, workflows])
const config = configFor(moduleKey)
  const widgets = config.dashboard.widgets || []
  const actions = quickActions || config.quickActions || []
  const visibleActions = actions.filter(action => !action.roles || action.roles.includes(role))

  return (
    <section className="module-dashboard">
      <div className="module-dashboard-head">
        <div>
          <h2>{config.dashboard.heading || 'Overview'}</h2>
          <p>Live statistics and next actions for this module.</p>
        </div>
        {visibleActions.length > 0 && (
          <div className="module-dashboard-quick">
            <span>Quick actions</span>
            {visibleActions.map((action, index) => (
              <button key={index} type="button" className="quick-action" onClick={() => onQuickAction && onQuickAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="module-widgets">
        {widgets.map((widget, index) => (
          <Widget key={widget.key || index} widget={widget} value={stats[widget.source]} />
        ))}
      </div>
    </section>
  )
}
