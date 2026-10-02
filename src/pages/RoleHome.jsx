import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Icon } from '../components/Sidebar'
import AnimatedNumber from '../components/AnimatedNumber'
import { BookOpen, Target, CheckCircle, ArrowRight, Sparkles, Clock } from 'lucide-react'
import PageBanner from '../components/PageBanner'

const pct = value => `${Math.round(Number(value || 0))}%`
const getRole = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return undefined }
}

export default function RoleHome({ role, name }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const userRole = role || getRole()
  const supervisor = userRole === 'supervisor'
  const management = userRole === 'management'
  const operationsManager = userRole === 'operations_manager'
  const hr = userRole === 'hr'
  const employee = userRole === 'employee'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const calls = []
      // HR & operations_manager can access the full dashboard analytics.
      if (hr || operationsManager) calls.push(api.analytics().catch(() => null))
      // Everyone with an employee record can see their own analytics.
      if (supervisor || management || employee || operationsManager) calls.push(api.analyticsMe().catch(() => null))
      // Workflow statistics relevant to the role.
      calls.push(api.workflows().catch(() => ({ workflows: [], total: 0 })))
      // Certificates for operations_manager & employee.
      if (operationsManager || employee) calls.push(api.certificates().catch(() => ({ certificates: [] })))
      // Real assigned development plans and courses
      calls.push(api.learningAssignments().catch(() => ({ assignments: [] })))

      const results = await Promise.all(calls)
      let index = 0
      const dashboard = (hr || operationsManager) ? results[index++] : null
      const me = (supervisor || management || employee || operationsManager) ? results[index++] : null
      const workflowData = results[index++] || { workflows: [], total: 0 }
      const certData = (operationsManager || employee) ? results[index++] : null
      const assignmentData = results[index++] || { assignments: [] }

      const workflows = workflowData.workflows || []
      const assignments = assignmentData.assignments || []
      const activeWorkflows = workflows.filter(w => w.status === 'active')
      const completedWorkflows = workflows.filter(w => w.status === 'completed')
      const myEmployee = me?.employee || null
      const readiness = me?.readiness || null

      // Derive live cards per role.
      let cards = []
      if (hr) {
        const totals = dashboard?.totals || {}
        const performance = Math.round(Number(totals.average_performance || 0))
        const learning = Math.round(Number(totals.learning_completion || 0))
        const successionReady = Number(totals.succession_ready || 0)
        cards = [
          ['Total employees', totals.total_employees ?? 0, 'Live count of active workforce records.', 'Live', 'users', 'purple'],
          ['Average performance', pct(performance), 'Organization-wide performance average.', 'Live', 'trend', 'emerald'],
          ['Learning completion', pct(learning), 'Average learning progress across employees.', 'Live', 'book', 'amber'],
          ['Succession ready', successionReady, 'Employees scoring in the ready-now band.', 'Live', 'crown', 'rose'],
        ]
      } else if (operationsManager) {
        const totals = dashboard?.totals || {}
        const certs = certData?.certificates || []
        const validCerts = certs.filter(c => c.status === 'issued').length
        const trainingCompleted = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'completed').reduce((s, w) => s + Number(w.count), 0)
        const trainingActive = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'active').reduce((s, w) => s + Number(w.count), 0)
        const trainingTotal = trainingCompleted + trainingActive
        const completionRate = trainingTotal ? Math.round((trainingCompleted / trainingTotal) * 100) : 0
        cards = [
          ['Operations overview', pct(totals.average_performance || 0), 'Live department performance average.', 'Live', 'trend', 'purple'],
          ['Certificate status', `${validCerts}/${certs.length || 0}`, 'Issued certificates out of total on record.', 'Live', 'award', 'cyan'],
          ['Training completion', trainingTotal ? pct(completionRate) : '—', 'Completed vs. total training workflows.', 'Live', 'calendar', 'amber'],
          ['Learning progress', pct(totals.learning_completion || 0), 'Live average learning progress.', 'Live', 'book', 'emerald'],
        ]
      } else if (supervisor) {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const activeCount = activeWorkflows.length
        const recognitionPending = workflows.filter(w => w.module === 'recognition' && w.status === 'active').length
        cards = [
          ['Team performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record', 'trend', 'purple'],
          ['Learning completion', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record', 'book', 'emerald'],
          ['Active workflows', activeCount, 'Workflows currently awaiting action.', 'Live', 'grid', 'cyan'],
          ['Recognition pending', recognitionPending, 'Recognition workflows in progress.', 'Live', 'heart', 'rose'],
        ]
      } else if (management) {
        const successionActive = workflows.filter(w => w.module === 'succession' && w.status === 'active').length
        const successionCompleted = completedWorkflows.filter(w => w.module === 'succession').length
        const readinessReady = readiness?.band === 'ready_now' ? 1 : 0
        cards = [
          ['Succession approvals', successionActive, 'Succession workflows awaiting approval.', 'Live', 'crown', 'purple'],
          ['Ready-now candidates', readinessReady, 'Your readiness band indicator.', 'Live', 'users', 'emerald'],
          ['Approved cycles', successionCompleted, 'Completed succession planning cycles.', 'Live', 'award', 'cyan'],
          ['Planning cycles', workflows.filter(w => w.module === 'succession').length, 'Total succession workflows on record.', 'Live', 'calendar', 'amber'],
        ]
      } else {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const competency = myEmployee?.competency_score ?? null
        const certs = certData?.certificates || []
        const myCerts = certs.filter(c => c.status === 'issued').length
        cards = [
          ['My performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record', 'trend', 'purple'],
          ['Learning progress', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record', 'book', 'emerald'],
          ['Competency', competency !== null ? pct(competency) : '—', 'Your recorded competency score.', competency !== null ? 'Live' : 'No record', 'zap', 'cyan'],
          ['Certificates', myCerts, 'Certificates issued to you.', 'Live', 'award', 'rose'],
        ]
      }

      setData({ cards, workflows, activeWorkflows, completedWorkflows, assignments })
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [hr, operationsManager, supervisor, management, employee])

  useEffect(() => {
    void load()

    const handleSync = () => { void load() }
    window.addEventListener('pds:refresh-dashboard', handleSync)

    const interval = setInterval(() => { void load() }, 45000)
    return () => {
      window.removeEventListener('pds:refresh-dashboard', handleSync)
      clearInterval(interval)
    }
  }, [load])

  if (loading) {
    return (
      <main className="role-home saas-role-home">
        <div className="role-home-head" style={{ minHeight: 48, marginBottom: 20 }}>
          <div className="skeleton-bar" style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton-bar" style={{ width: 280, height: 26, borderRadius: 8 }} />
        </div>
        <section className="role-home-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton-bar" style={{ height: 140, borderRadius: 14 }} />
          ))}
        </section>
        <div className="skeleton-bar" style={{ height: 120, borderRadius: 14, marginTop: 24 }} />
      </main>
    )
  }

  const title = supervisor
    ? 'Team Development Dashboard'
    : management
      ? 'Leadership Dashboard'
      : operationsManager
        ? 'Operations Performance Dashboard'
        : 'My Development Dashboard'

  const description = supervisor
    ? 'Manage your team’s performance, learning, and workflow actions.'
    : management
      ? `Welcome back, ${name || 'Executive'}. Review succession plans awaiting senior management approval.`
      : operationsManager
        ? 'Monitor cross-functional operations performance, certifications, and training progress.'
        : `Welcome back, ${name || 'Team Member'}. Track your personal growth and development.`

  const nextTitle = supervisor ? 'Next team action' : management ? 'Next approval' : operationsManager ? 'Next monitoring action' : 'Next action'
  const nextDetail = supervisor
    ? 'Review outstanding performance submissions and help employees complete assigned learning.'
    : management
      ? 'Review proposed succession candidates and approve the finalized plan.'
      : operationsManager
        ? 'Monitor analytics and certificate status across the operation.'
        : 'Complete your current review step and continue your assigned learning activities.'

  const cardRoutes = {
    'Certificates': '/certificates',
    'Certificate status': '/certificates',
    'My performance': '/performance',
    'Team performance': '/performance',
    'Learning progress': '/learning',
    'Learning completion': '/learning',
    'Competency': '/competency',
    'Training completion': '/training',
    'Succession ready': '/succession',
    'Succession approvals': '/succession',
    'Operations overview': '/performance',
    'Approved cycles': '/succession',
    'Planning cycles': '/succession',
    'Total employees': '/employees',
    'Average performance': '/performance',
    'Active workflows': '/performance',
    'Recognition pending': '/recognition',
    'Ready-now candidates': '/succession',
  }

  const cards = data?.cards || []

  return (
    <main className="role-home saas-role-home">
      <PageBanner
        title={title}
        subtitle={`${description}`}
        badge={userRole ? userRole.replace(/_/g, ' ').toUpperCase() : 'DASHBOARD'}
        icon={<Target className="w-5 h-5 text-white" />}
      />

      {error && (
        <div className="role-home-error" role="alert">
          <p>{error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="role-home-grid">
        {cards.map(([label, value, detail, live, iconName = 'grid', colorTheme = 'purple']) => {
          const targetRoute = cardRoutes[label]
          return (
            <article
              key={label}
              onClick={targetRoute ? () => navigate(targetRoute) : undefined}
              className={`role-kpi-card card-${colorTheme}`}
              style={{ cursor: targetRoute ? 'pointer' : 'default' }}
              title={targetRoute ? `View ${label}` : undefined}
            >
              <div className="role-card-top">
                <div className={`role-icon-box ${colorTheme}-box`}>
                  <Icon name={iconName} size={18} />
                </div>
                <em className="role-live-chip">{live}</em>
              </div>
              <div className="role-card-body">
                <small>{label}</small>
                <b><AnimatedNumber value={value} /></b>
                <p>{detail}</p>
              </div>
              {targetRoute && (
                <div className="role-card-hover-hint">
                  <span>Explore module</span>
                  <Icon name="chevron" size={14} />
                </div>
              )}
            </article>
          )
        })}
      </section>

      {/* Assigned Development Plans & Learning Paths (for employees, supervisors, and HR) */}
      {(employee || supervisor || (data?.assignments || []).length > 0) && (
        <section className="role-home-dev-plans" style={{ marginTop: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(17,24,39,0.1)', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  {employee ? 'My Assigned Development Plans & Courses' : 'Assigned Development Plans & Courses'}
                </h3>
                <small style={{ color: '#64748b' }}>
                  {employee ? 'Learning courses assigned to address your competency and skill gaps' : 'Current employee development and study assignments'}
                </small>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/learning')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', color: '#111827',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px',
              }}
            >
              View in Learning Center <ArrowRight size={13} />
            </button>
          </div>

          {(data?.assignments || []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {(data.assignments).slice(0, 6).map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate('/learning')}
                  style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1.5px solid var(--border, #ecebf2)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'all 0.18s ease',
                  }}
                  className="role-dev-plan-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'rgba(17, 24, 39, 0.1)', color: '#111827', textTransform: 'uppercase' }}>
                        {a.category || 'Skill Development'}
                      </span>
                      <h4 style={{ margin: '6px 0 2px', fontSize: 13, fontWeight: 700, color: 'inherit' }}>
                        {a.resource_title}
                      </h4>
                      {!employee && a.employee_name && (
                        <small style={{ color: '#64748b', display: 'block' }}>{a.employee_name} · {a.department}</small>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                        background: a.status === 'completed' ? 'rgba(16,185,129,0.1)' : a.status === 'studying' ? 'rgba(17, 24, 39, 0.1)' : 'rgba(245,158,11,0.1)',
                        color: a.status === 'completed' ? '#059669' : a.status === 'studying' ? '#111827' : '#d97706',
                      }}
                    >
                      {a.status ? a.status.replace('_', ' ') : 'Not started'}
                    </span>
                  </div>

                  {(a.competencies || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {a.competencies.map(c => (
                        <span key={c} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                          Gap: {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      <span>Study Progress</span>
                      <span>{a.progress || 0}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', width: `${a.progress || 0}%`,
                          background: a.progress >= 100 ? '#10b981' : 'linear-gradient(90deg, #111827, #111827)',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '18px', borderRadius: 12, background: 'rgba(17, 24, 39, 0.03)', border: '1px dashed rgba(17, 24, 39, 0.2)', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 600 }}>No development plans assigned yet.</p>
              <small style={{ color: '#64748b' }}>When HR or your supervisor assigns a learning course or development plan, it will appear here.</small>
            </div>
          )}
        </section>
      )}

      {/* Next Priority Action Card */}
      <div className="role-home-action-banner">
        <div className="action-banner-icon">
          <Icon name="zap" size={20} />
        </div>
        <div className="action-banner-text">
          <h2>{nextTitle}</h2>
          <p>{nextDetail}</p>
        </div>
      </div>
    </main>
  )
}


