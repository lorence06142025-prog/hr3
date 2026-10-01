import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/exportUtils'
import { Download, ShieldCheck, Activity } from 'lucide-react'
import PageBanner from '../components/PageBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const categoryLabels = {
  auth: 'Authentication',
  employee: 'Employees',
  certificate: 'Certificates',
  learning: 'Learning',
  workflow: 'Workflows',
  notification: 'Notifications',
  system: 'System',
}

const roleLabels = {
  hr: 'HR',
  supervisor: 'Supervisor',
  management: 'Management',
  operations_manager: 'Ops Manager',
  employee: 'Employee',
}

const actionLabel = (action) => {
  if (!action) return '—'
  return action
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

// ─────────────────────────────────────────────────────────────────────────────
// System Health tab
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_META = {
  operational:    { dot: 'health-dot-green', badge: 'health-badge-green', label: 'Operational',    badgeCls: 'health-overall-operational' },
  needs_attention: { dot: 'health-dot-amber', badge: 'health-badge-amber', label: 'Needs Attention', badgeCls: 'health-overall-warning' },
  degraded:       { dot: 'health-dot-red',   badge: 'health-badge-red',   label: 'Degraded',        badgeCls: 'health-overall-degraded' },
}

function SystemHealthTab() {
  const [health, setHealth]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastAt, setLastAt]   = useState(null)
  const timerRef = useRef(null)

  const fetchHealth = async () => {
    try {
      const data = await api.systemHealth()
      setHealth(data)
      setLastAt(new Date())
    } catch {
      // keep stale data if fetch fails
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    timerRef.current = setInterval(fetchHealth, 30000)
    return () => clearInterval(timerRef.current)
  }, [])

  const services  = health?.services || []
  const overall   = health?.overall  || 'operational'
  const overallM  = STATUS_META[overall] || STATUS_META.operational
  const opCount   = services.filter(s => s.status === 'operational').length
  const warnCount = services.filter(s => s.status === 'needs_attention').length
  const degCount  = services.filter(s => s.status === 'degraded').length

  return (
    <div className="health-tab-root">
      {/* ── Summary strip ──────────────────────────────────────────── */}
      <div className="health-summary-strip">
        <div className={`health-overall-badge ${overallM.badgeCls}`}>
          <span className={overallM.dot} />
          {overallM.label}
        </div>
        <div className="health-summary-counts">
          <span className="health-count green">{opCount} Operational</span>
          {warnCount > 0 && <span className="health-count amber">{warnCount} Needs Attention</span>}
          {degCount  > 0 && <span className="health-count red">{degCount} Degraded</span>}
        </div>
        <div className="health-refresh-info">
          {lastAt && <>Last checked: <b>{lastAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b></>}
          {loading && <span className="health-checking"> · Checking…</span>}
          <span className="health-auto-note"> · auto-refreshes every 30s</span>
        </div>
      </div>

      {/* ── Services grid ──────────────────────────────────────────── */}
      <div className="health-services-grid">
        {loading && services.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="health-service-card health-service-loading">
                <div className="health-svc-top">
                  <span className="health-dot-gray" />
                  <div className="health-svc-skeleton-name" />
                </div>
                <div className="health-svc-skeleton-detail" />
                <div className="health-svc-badge-skeleton" />
              </div>
            ))
          : services.map(svc => {
              const m = STATUS_META[svc.status] || STATUS_META.operational
              return (
                <div key={svc.name} className={`health-service-card health-svc-${svc.status}`}>
                  <div className="health-svc-top">
                    <span className={m.dot} />
                    <span className="health-svc-name">{svc.name}</span>
                  </div>
                  <p className="health-svc-detail">{svc.detail}</p>
                  <span className={`health-svc-badge ${m.badge}`}>{m.label}</span>
                </div>
              )
            })
        }
      </div>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="health-legend">
        <span className="health-legend-item"><span className="health-dot-green-sm" /> Operational — all queries responding normally</span>
        <span className="health-legend-item"><span className="health-dot-amber-sm" /> Needs Attention — service available but misconfigured</span>
        <span className="health-legend-item"><span className="health-dot-red-sm" />   Degraded — service unavailable or throwing errors</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState('audit') // 'audit' | 'health'

  // ── Audit Trail state ──────────────────────────────────────────────────────
  const [logs, setLogs]           = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
  const [category, setCategory]   = useState('')
  // eslint-disable-next-line no-unused-vars
  const [action, setAction]       = useState('')
  const [query, setQuery]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const load = async (page = 1) => {
    setLoading(true); setError('')
    try {
      const params = { page, limit: 50 }
      if (category) params.category = category
      if (action)   params.action   = action
      const result = await api.auditLogs(params)
      setLogs(result.logs || [])
      setPagination(result.pagination || { page: 1, limit: 50, total: 0, pages: 1 })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (activeTab !== 'audit') return
    const t = setTimeout(() => load(1), 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, action, activeTab])

  const filtered = useMemo(() => {
    if (!query.trim()) return logs
    const q = query.toLowerCase()
    return logs.filter(l =>
      `${l.actor_name || ''} ${l.description || ''} ${l.action || ''} ${l.category || ''}`
        .toLowerCase().includes(q)
    )
  }, [logs, query])

  const exportCsv = async () => {
    try {
      const params = { limit: 1000 }
      if (category) params.category = category
      if (action)   params.action   = action
      const result = await api.auditLogs(params)
      const rows = (result.logs || []).map(l => ({
        'Date': new Date(l.created_at).toLocaleString(),
        'Actor': l.actor_name || 'System',
        'Role': roleLabels[l.actor_role] || l.actor_role || '—',
        'Category': categoryLabels[l.category] || l.category || '',
        'Action': actionLabel(l.action),
        'Description': l.description || '',
        'IP Address': l.ip_address || '',
      }))
      downloadCsv(rows, `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { setError(e.message) }
  }

  const goToPage = (p) => {
    if (p < 1 || p > pagination.pages) return
    load(p)
  }

  const categories = Object.keys(categoryLabels)

  return (
    <main className="er-workspace">
      <PageBanner
        title="Audit & System Health"
        description="Monitor live service status and trace every user action across all modules."
        icon={<ShieldCheck className="w-5 h-5 text-white" />}
        actions={
          activeTab === 'audit' && (
            <button className="saas-btn-secondary flex items-center gap-1.5" onClick={exportCsv} title="Export the audit trail to CSV">
              <Download className="w-4 h-4 inline-block" />
              <span>Export CSV</span>
            </button>
          )
        }
      />

      {error && <p className="module-error">{error}</p>}

      {/* ── Page-level tabs ──────────────────────────────────────── */}
      <div className="audit-page-tabs">
        <button
          className={`audit-page-tab ${activeTab === 'audit' ? 'audit-page-tab-active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Activity className="w-4 h-4" />
          Audit Trail
        </button>
        <button
          className={`audit-page-tab ${activeTab === 'health' ? 'audit-page-tab-active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <ShieldCheck className="w-4 h-4" />
          System Health
        </button>
      </div>

      {/* ── System Health tab ────────────────────────────────────── */}
      {activeTab === 'health' && <SystemHealthTab />}

      {/* ── Audit Trail tab ──────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <>
          <section className="er-kpis">
            <article><small>Total events</small><b>{pagination.total}</b><em>Recorded trail entries</em></article>
            <article><small>Categories</small><b>{categories.length}</b><em>Auth, employees, certificates, learning, workflows…</em></article>
            <article><small>Page size</small><b>{pagination.limit}</b><em>Entries per page</em></article>
            <article><small>Pages</small><b>{pagination.pages}</b><em>Available in the trail</em></article>
          </section>

          <section className="er-panel">
            <div className="er-panel-head">
              <div>
                <h2>Activity log</h2>
                <p>Filter by category, action, or search the trail.</p>
              </div>
              <div className="er-filters">
                <div className="er-tabs">
                  <button className={`er-tab ${!category ? 'er-tab-active' : ''}`} onClick={() => setCategory('')}>All</button>
                  {categories.map(c => (
                    <button
                      key={c}
                      className={`er-tab ${category === c ? 'er-tab-active' : ''}`}
                      onClick={() => setCategory(category === c ? '' : c)}
                    >{categoryLabels[c]}</button>
                  ))}
                </div>
                <div className="employee-search">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search actor, description, action..." />
                </div>
              </div>
            </div>

            <div className="er-table-wrap">
              <table className="er-table">
                <thead>
                  <tr>
                    <th>When</th><th>Actor</th><th>Role</th>
                    <th>Category</th><th>Action</th><th>Description</th><th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="er-empty">Loading activity trail…</td></tr>
                  )}
                  {!loading && filtered.map(log => (
                    <tr key={log.id}>
                      <td title={new Date(log.created_at).toLocaleString()}>
                        <b>{timeAgo(log.created_at)}</b>
                        <small className="er-time">{new Date(log.created_at).toLocaleTimeString()}</small>
                      </td>
                      <td>
                        <div className="er-employee">
                          <span className="er-avatar">{log.actor_name ? log.actor_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : 'SYS'}</span>
                          <div>
                            <b>{log.actor_name || 'System'}</b>
                            <small>{log.actor_id ? 'Authenticated user' : 'Unauthenticated / system'}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="er-status active">{roleLabels[log.actor_role] || log.actor_role || '—'}</span></td>
                      <td><span className={`audit-category audit-cat-${log.category}`}>{categoryLabels[log.category] || log.category}</span></td>
                      <td><code className="audit-action">{actionLabel(log.action)}</code></td>
                      <td className="audit-desc">{log.description || '—'}</td>
                      <td><small>{log.ip_address || '—'}</small></td>
                    </tr>
                  ))}
                  {!loading && !filtered.length && (
                    <tr><td colSpan={7} className="er-empty">No activity found for the current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="er-pagination">
                <button disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>← Prev</button>
                <span>Page {pagination.page} of {pagination.pages}</span>
                <button disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next →</button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
