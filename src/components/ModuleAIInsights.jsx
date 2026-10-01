import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import AIReport from './AIReport'
import { Check, Sparkles } from 'lucide-react'

const METRIC_LABELS = {
  employee_count: 'Active Employees',
  average_score: 'Average Score',
  average_readiness: 'Average Readiness',
  average_performance: 'Average Performance',
  average_competency: 'Average Competency',
  learning_completion: 'Learning Completion',
  learning_progress: 'Learning Progress',
  resource_count: 'Courses',
  assigned_count: 'Course Assignments',
  completed_count: 'Completed Workflows',
  active_count: 'Active Workflows',
  ready_now_count: 'Ready Now Profiles',
  ready_later_count: 'Ready in 1-2 Years',
  development_count: 'Development Needed',
  candidate_count: 'Succession Candidates',
  total_sessions: 'Total Sessions',
  total_participants: 'Total Participants',
  attendance_rate: 'Attendance Rate',
  satisfaction_rate: 'Satisfaction Rate',
}

function formatMetricValue(key, value) {
  if (value == null) return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return value ?? '0'
  if (['average_score', 'average_readiness', 'average_performance', 'average_competency', 'learning_completion', 'learning_progress', 'attendance_rate', 'satisfaction_rate'].includes(key)) {
    return `${Math.round(num)}%`
  }
  return String(Math.round(num))
}

const confidenceFromMetrics = metrics => {
  if (!metrics) return null
  const entries = Object.entries(metrics).filter(([key]) => METRIC_LABELS[key])
  if (!entries.length) return null
  const populated = entries.filter(([, value]) => {
    if (value == null) return false
    if (typeof value === 'number') return !isNaN(value)
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  }).length
  const score = Math.round((populated / entries.length) * 100)
  const level = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  return { score, level }
}

export default function ModuleAIInsights({ module, stage, workflowId }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const isHr = role === 'hr'
  const canGenerateOwn = role === 'employee' || isHr || role === 'supervisor' || role === 'management' || role === 'operations_manager'
  const [savedReports, setSavedReports] = useState([])
  const [metricsPreview, setMetricsPreview] = useState(null)
  const [workflowMeta, setWorkflowMeta] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [viewingReport, setViewingReport] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadReports = async () => {
      if (workflowId) {
        try {
          const [reportsResult, workflowResult] = await Promise.all([
            api.workflowReports(workflowId),
            api.workflow(workflowId).catch(() => ({ workflow: null })),
          ])
          if (cancelled) return
          setSavedReports(reportsResult.reports || [])
          setWorkflowMeta(workflowResult.workflow || null)
          const preview = (reportsResult.reports || []).find(r => !r.generated_by_model)
          setMetricsPreview(preview ? (preview.metrics_json || {}) : null)
        } catch (requestError) {
          if (!cancelled) setError(requestError.message)
        }
      } else if (module) {
        // Do not auto-generate AI insights on load.
        // AI insights will only be generated when the user explicitly clicks the "Generate AI Insights" button.
        setSavedReports([])
        setMetricsPreview(null)
        setViewingReport(null)
      }
    }
    void loadReports()
    return () => { cancelled = true }
  }, [workflowId, module, stage])

  const generate = async () => {
    setGenerating(true); setError('')
    try {
      if (workflowId) {
        const result = await api.generateWorkflowReport(workflowId)
        const reports = await api.workflowReports(workflowId)
        setSavedReports(reports.reports || [])
        setMetricsPreview(null)
        setViewingReport(result.report || null)
      } else if (module) {
        const result = await api.generateModuleInsights(module, stage || 'Overview')
        const reportObj = {
          id: 'module-report-' + Date.now(),
          title: result.insights?.[0]?.title || `${module[0].toUpperCase()}${module.slice(1)} Management Report`,
          content: result.insights?.[0]?.summary || '',
          created_at: new Date().toISOString(),
          generated_by_model: 'Priority Handling Services, Inc. AI',
          metrics_json: result.metrics || {},
        }
        setSavedReports([reportObj])
        setViewingReport(reportObj)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGenerating(false)
    }
  }

  const downloadPdf = async report => {
    if (!report?.id) return
    try {
      const blob = await api.downloadReportPdf(report.id)
      if (!blob) { setError('PDF download is not available for this report.'); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(report.title || 'ai-report').replace(/\s+/g, '-').toLowerCase()}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const latestGenerated = savedReports.find(r => r.generated_by_model || r.content) || null
  const hasGenerated = Boolean(latestGenerated)
  const status = hasGenerated ? 'Generated' : 'Ready to Generate'
  const previewEntries = metricsPreview ? Object.entries(metricsPreview).filter(([key]) => METRIC_LABELS[key]) : []
  const confidence = confidenceFromMetrics(latestGenerated?.metrics_json || metricsPreview)
  const dataSources = useMemo(() => {
    const json = latestGenerated?.metrics_json || metricsPreview || {}
    return Object.keys(json).filter(key => METRIC_LABELS[key])
  }, [latestGenerated, metricsPreview])

  const recordsAnalyzed = useMemo(() => {
    const json = latestGenerated?.metrics_json || metricsPreview || {}
    const keys = Object.keys(json).filter(key => METRIC_LABELS[key])
    return keys.length
  }, [latestGenerated, metricsPreview])

  const shownReport = viewingReport || latestGenerated
  const lastUpdated = workflowMeta?.updated_at || metricsPreview?.last_updated || latestGenerated?.created_at

  return (
    <aside className="module-insights insight-panel">
      <div className="insight-title">
        <div>
          <h2>AI Insights</h2>
          <p>{canGenerateOwn ? (isHr ? 'HR can generate / regenerate reports' : 'You can generate AI insights') : 'Read-only view'}</p>
        </div>
        <span className={`report-status-badge ${hasGenerated ? 'generated' : 'ready'}`}>{status}</span>
      </div>
      {error && <p className="ai-error">{error}</p>}

      {/* Metrics Preview — calculated database values */}
      {previewEntries.length > 0 && !hasGenerated && (
        <section className="metrics-preview">
          <div className="metrics-preview-head">
            <b>Metrics Summary</b>
            <small>Calculated from database</small>
          </div>
          <div className="metrics-ready-badge"><Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Metrics ready</div>
          <div className="metrics-preview-grid">
            {previewEntries.map(([key, value]) => (
              <article key={key}>
                <small>{METRIC_LABELS[key]}</small>
                <b>{formatMetricValue(key, value)}</b>
              </article>
            ))}
          </div>
          <div className="metrics-stats-row">
            <span><b>{recordsAnalyzed}</b> records analyzed</span>
          </div>
          {confidence && (
            <div className="metrics-confidence">
              <span>Data completeness</span>
              <i><em style={{ width: `${confidence.score}%` }} /></i>
              <b>{confidence.level} ({confidence.score}%)</b>
            </div>
          )}
          {lastUpdated && <small className="metrics-updated">Last updated: {new Date(lastUpdated).toLocaleString()}</small>}
        </section>
      )}

      {/* Generated report metadata */}
      {hasGenerated && (
        <div className="report-meta">
          <span className="report-date">Generated {new Date(latestGenerated.created_at).toLocaleString()}</span>
          {latestGenerated.generated_by_model && <span className="model-chip">{latestGenerated.generated_by_model}</span>}
          <span className="records-chip">{recordsAnalyzed} records analyzed</span>
          {confidence && <span className={`confidence-chip ${confidence.level.toLowerCase()}`}>{confidence.level} confidence ({confidence.score}%)</span>}
        </div>
      )}

      {loading ? (
        <div className="insight-empty"><b>Analyzing module data</b><p>Reviewing current workflow records for this module.</p></div>
      ) : shownReport && hasGenerated ? (
        <div className="insight-results">
          <AIReport content={shownReport.content} title={shownReport.title} />
          {dataSources.length > 0 && (
            <div className="report-sources">
              <small>Data sources analyzed</small>
              <div className="source-chips">
                {dataSources.map(source => <span key={source}>{METRIC_LABELS[source]}</span>)}
              </div>
            </div>
          )}
          {canGenerateOwn && (
            <div className="module-actions report-actions" style={{ marginTop: 16 }}>
              <button
                className="ai-generate"
                onClick={generate}
                disabled={generating}
                style={{
                  background: '#29282D',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-block',
                  width: 'auto',
                  boxShadow: 'none',
                }}
              >
                {generating ? 'Generating...' : 'Regenerate Brief'}
              </button>
              {latestGenerated?.id?.startsWith('workflow') && (
                <div className="report-button-row" style={{ display: 'inline-flex', gap: 8, marginLeft: 8 }}>
                  <button className="ai-secondary" onClick={() => setViewingReport(null)}>View Report</button>
                  <button className="ai-secondary" onClick={() => downloadPdf(latestGenerated)}>Download PDF</button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="insight-empty" style={{ textAlign: 'left', padding: '12px 0' }}>
          <b style={{ fontSize: 13, display: 'block', color: '#111827', marginBottom: 4, fontWeight: 700 }}>
            {canGenerateOwn ? 'AI workforce brief ready' : 'No AI insight yet'}
          </b>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px 0', lineHeight: 1.4 }}>
            {canGenerateOwn
              ? (isHr
                  ? 'Generate a workforce analytics report from the current database values.'
                  : 'Metrics for this module have been calculated. Generate your AI insight when ready.')
              : 'An AI insight has not been generated for this module yet.'}
          </p>

          {canGenerateOwn && (
            <button
              className="insight-cta ai-generate"
              onClick={generate}
              disabled={generating}
              style={{
                background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                width: 'auto',
                boxShadow: '0 4px 12px rgba(17,24,39,0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              {generating ? 'Generating Insights...' : <><Sparkles size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} /> Generate AI Insights</>}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
