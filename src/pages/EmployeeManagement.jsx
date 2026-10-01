import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/exportUtils'
import {
  Download, CheckCircle, ShieldCheck, Zap, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus, Award, AlertCircle, BarChart3, Clock, Target, Calendar, User, Users, Briefcase, ChevronRight, X
} from 'lucide-react'
import PageBanner from '../components/PageBanner'

const roleLabels = { employee: 'Employee', supervisor: 'Supervisor', management: 'Management', hr: 'HR', operations_manager: 'Ops Manager' }

const initials = name => (name || '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [usersByEmployee, setUsersByEmployee] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [history, setHistory] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'employee', fullName: '', departmentId: '' })
  const [form, setForm] = useState({
    employeeNumber: '', fullName: '', departmentId: '', jobTitle: '',
    managerId: '', performanceScore: 0, competencyScore: 0, learningProgress: 0,
    email: '', password: '', role: 'employee',
  })
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // 5-second password peek state for employee creation
  const [showEmpPass, setShowEmpPass] = useState(false)
  const [empPassSeconds, setEmpPassSeconds] = useState(0)
  const empTimerRef = useRef(null)

  const handleToggleEmpPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (empTimerRef.current) clearInterval(empTimerRef.current)

    setShowEmpPass(true)
    setEmpPassSeconds(5)

    empTimerRef.current = setInterval(() => {
      setEmpPassSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(empTimerRef.current)
          setShowEmpPass(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const generateRandomPassword = (e) => {
    e.preventDefault()
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
    let generated = 'Hotel'
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    generated += '1!'
    setForm((prev) => ({ ...prev, password: generated }))
  }

  const load = async () => {
    try {
      const [empResult, deptResult] = await Promise.all([
        filter === 'all' ? api.employeesAll() : api.employees(),
        api.departments(),
      ])
      setEmployees(empResult.employees || [])
      setDepartments(deptResult.departments || [])
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [filter])

  // Real-time refresh: whenever a workflow completes (or any other module
  // fires pds:refresh-dashboard), reload employee records so the updated
  // performance_score, competency_score, and learning_progress are shown
  // immediately without requiring a manual page refresh.
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('pds:refresh-dashboard', handleRefresh)
    return () => window.removeEventListener('pds:refresh-dashboard', handleRefresh)
  }, [filter])

  // Surgical in-place update — when a specific employee's score changes from
  // a completed performance workflow, update just that row instantly without
  // waiting for a full API reload.
  useEffect(() => {
    const handleScoreUpdate = (e) => {
      const updated = e.detail
      if (!updated?.id) return
      setEmployees(prev => prev.map(emp =>
        emp.id === updated.id
          ? {
              ...emp,
              performance_score: updated.performance_score ?? emp.performance_score,
              competency_score: updated.competency_score ?? emp.competency_score,
              learning_progress: updated.learning_progress ?? emp.learning_progress,
            }
          : emp
      ))
    }
    window.addEventListener('pds:employee-score-updated', handleScoreUpdate)
    return () => window.removeEventListener('pds:employee-score-updated', handleScoreUpdate)
  }, [])

  const resetForm = () => {
    setForm({
      employeeNumber: '',
      fullName: '',
      departmentId: departments[0]?.id || '',
      jobTitle: '',
      managerId: '',
      performanceScore: 0,
      competencyScore: 0,
      learningProgress: 0,
      email: '',
      password: '',
      role: 'employee',
    })
    setEditId(null)
    setShowEmpPass(false)
    if (empTimerRef.current) clearInterval(empTimerRef.current)
  }

  const openEdit = (emp) => {
    setForm({
      employeeNumber: emp.employee_number,
      fullName: emp.full_name,
      departmentId: emp.department_id || departments[0]?.id || '',
      jobTitle: emp.job_title,
      managerId: emp.manager_id || '',
      performanceScore: emp.performance_score,
      competencyScore: emp.competency_score,
      learningProgress: emp.learning_progress,
      email: '',
      password: '',
      role: 'employee',
    })
    setEditId(emp.id)
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setSaving(true)
    try {
      const data = { ...form, managerId: form.managerId || null, departmentId: form.departmentId || departments[0]?.id }
      if (editId) {
        await api.updateEmployee(editId, data)
        setNotice('Employee updated successfully.')
      } else {
        await api.createEmployee(data)
        setNotice('Employee created successfully.')
      }
      setShowForm(false); resetForm();
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleActive = async (emp) => {
    setError(''); setNotice('')
    try {
      if (emp.is_active) {
        await api.deactivateEmployee(emp.id)
        setNotice(`${emp.full_name} has been deactivated.`)
      } else {
        await api.reactivateEmployee(emp.id)
        setNotice(`${emp.full_name} has been reactivated.`)
      }
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (e) { setError(e.message) }
  }

  const showHistory = async (emp) => {
    setError('')
    try {
      const result = await api.employeeHistory(emp.id)
      setHistory({
        employee: emp.full_name,
        employeeData: emp,
        history: result.history || [],
      })
    } catch (e) { setError(e.message) }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setSaving(true)
    try {
      const result = await api.invite({ ...inviteForm, departmentId: inviteForm.departmentId || null })
      setNotice(`Invitation created for ${inviteForm.fullName}.`)
      setInviteOpen(false)
      setInviteForm({ email: '', role: 'employee', fullName: '', departmentId: '' })
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const filtered = useMemo(() => employees.filter(e =>
    `${e.full_name} ${e.department_name || e.department} ${e.job_title} ${e.employee_number}`
      .toLowerCase().includes(query.toLowerCase())
  ), [employees, query])

  const activeCount = employees.filter(e => e.is_active).length
  const deptCount = new Set(employees.map(e => e.department_name || e.department).filter(Boolean)).size

  const exportCsv = async () => {
    try {
      const rows = await api.exportEmployeesCsv()
      const formatted = rows.map(e => ({
        'Employee Number': e.employee_number,
        'Full Name': e.full_name,
        'Department': e.department_name || e.department || '',
        'Job Title': e.job_title || '',
        'Performance Score': e.performance_score || 0,
        'Competency Score': e.competency_score || 0,
        'Learning Progress': e.learning_progress || 0,
        'Status': e.is_active ? 'Active' : 'Inactive',
      }))
      downloadCsv(formatted, `employees-${new Date().toISOString().slice(0,10)}.csv`)
    } catch (e) { setError(e.message) }
  }

  return (
    <main className="er-workspace">
      <PageBanner
        title="Employee Records"
        description="Manage the employee lifecycle, organizational assignments, and system access."
        icon={<Users className="w-5 h-5 text-white" />}
        actions={
          <>
            <button className="saas-btn-secondary flex items-center gap-1.5" onClick={exportCsv} title="Export all employee records to CSV">
              <Download className="w-4 h-4 inline" />
              <span>Export CSV</span>
            </button>
            <button className="saas-btn-secondary" onClick={() => setInviteOpen(true)}>Send invite</button>
            <button className="saas-btn-primary" onClick={() => { resetForm(); setShowForm(true) }} style={{ background: '#111827', color: '#ffffff', border: 'none', fontWeight: 600, boxShadow: '0 2px 8px rgba(17,24,39,0.35)' }}>+ Add employee</button>
          </>
        }
      />

      {notice && <p className="module-notice"><CheckCircle className="w-4 h-4 inline mr-1 text-emerald-500" /> {notice}</p>}
      {error && <p className="module-error">{error}</p>}

      <section className="er-kpis">
        <article><small>Total employees</small><b>{employees.length}</b><em>{filter === 'all' ? 'Including inactive' : 'Active records'}</em></article>
        <article><small>Active accounts</small><b>{activeCount}</b><em>{Math.round((activeCount / Math.max(employees.length, 1)) * 100)}% of records</em></article>
        <article><small>Departments</small><b>{deptCount}</b><em>Across the organization</em></article>
        <article><small>Workforce health</small><b>{employees.length ? Math.round(employees.reduce((s, e) => s + (Number(e.performance_score) || 0), 0) / employees.length) : 0}%</b><em>Avg performance score</em></article>
      </section>

      <section className="er-panel">
        <div className="er-panel-head">
          <div>
            <h2>Employee directory</h2>
            <p>Search and manage all employee records.</p>
          </div>
          <div className="er-filters">
            <div className="er-tabs">
              <button className={`er-tab ${filter === 'active' ? 'er-tab-active' : ''}`} onClick={() => setFilter('active')}>Active</button>
              <button className={`er-tab ${filter === 'all' ? 'er-tab-active' : ''}`} onClick={() => setFilter('all')}>All</button>
            </div>
            <div className="employee-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, department, job title..." />
            </div>
          </div>
        </div>

        <div className="er-table-wrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Performance</th>
                <th>Competency</th>
                <th>Learning</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="er-employee">
                      {emp.avatar_url ? (
                        <img
                          src={emp.avatar_url}
                          alt={emp.full_name}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            display: 'block',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span className="er-avatar">{initials(emp.full_name)}</span>
                      )}
                      <div>
                        <b>{emp.full_name}</b>
                        <small>{emp.employee_number}</small>
                      </div>
                    </div>
                  </td>
                  <td>{emp.department_name || emp.department || '—'}</td>
                  <td>{emp.job_title}</td>
                  <td><span className="er-score">{emp.performance_score || 0}%</span></td>
                  <td><span className="er-score">{emp.competency_score || 0}%</span></td>
                  <td><span className="er-score">{emp.learning_progress || 0}%</span></td>
                  <td><span className={`er-status ${emp.is_active ? 'active' : 'inactive'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="er-row-actions">
                      <button title="Edit" onClick={() => openEdit(emp)}>Edit</button>
                      <button title="Score history" onClick={() => showHistory(emp)}>History</button>
                      <button className={emp.is_active ? 'danger' : 'ok'} title={emp.is_active ? 'Deactivate' : 'Reactivate'} onClick={() => toggleActive(emp)}>
                        {emp.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={8} className="er-empty">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit modal */}
      {showForm && createPortal(
        <div className="er-modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="settings-dialog er-dialog" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit employee' : 'Add employee'}</h2>
            <p className="er-dialog-sub">{editId ? 'Update the employee record below.' : 'Create a new employee record.'}</p>
            <form onSubmit={save}>
              <div className="er-form-grid">
                <label>Employee number<input value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} required disabled={!!editId} /></label>
                <label>Full name<input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required /></label>
                <label>Department<select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
                <label>Job title<input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} required /></label>
                <label className="er-full">Manager<select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}>
                  <option value="">— No manager —</option>
                  {employees.filter(e => e.is_active && e.id !== editId).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select></label>
                <label>Performance %<input type="number" min={0} max={100} value={form.performanceScore} onChange={e => setForm({ ...form, performanceScore: Number(e.target.value) })} /></label>
                <label>Competency %<input type="number" min={0} max={100} value={form.competencyScore} onChange={e => setForm({ ...form, competencyScore: Number(e.target.value) })} /></label>
                <label className="er-full">Learning %<input type="number" min={0} max={100} value={form.learningProgress} onChange={e => setForm({ ...form, learningProgress: Number(e.target.value) })} /></label>

                {!editId && (
                  <>
                    <div className="er-full" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
                      <b style={{ fontSize: 13, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>User Login Account &amp; RBAC Access</span>
                      </b>
                      <small style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                        Provide credentials below to immediately provision this employee's sign-in account and role permissions.
                      </small>
                    </div>

                    <label>
                      System Role (RBAC)
                      <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                        <option value="employee">Employee (Hospitality Staff)</option>
                        <option value="supervisor">Supervisor / Department Head</option>
                        <option value="operations_manager">Operations Manager</option>
                        <option value="management">Senior Management</option>
                        <option value="hr">HR Administrator</option>
                      </select>
                    </label>

                    <label>
                      Work Email
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="e.g. employee@hotel.com"
                      />
                    </label>

                    <label className="er-full">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span>Account Password</span>
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#111827',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Generate Password</span>
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showEmpPass ? 'text' : 'password'}
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          placeholder="Enter initial password (min 6 characters)"
                          style={{ width: '100%', paddingRight: 80 }}
                        />
                        <button
                          type="button"
                          onClick={handleToggleEmpPassword}
                          title={showEmpPass ? `Visible for ${empPassSeconds}s` : 'Show password for 5 seconds'}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: showEmpPass ? '#f3e8ff' : '#f1f5f9',
                            color: showEmpPass ? '#111827' : '#475569',
                            border: showEmpPass ? '1px solid #c084fc' : '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            zIndex: 2,
                          }}
                        >
                          {showEmpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>{showEmpPass ? `${empPassSeconds}s` : 'Show'}</span>
                        </button>
                      </div>
                    </label>
                  </>
                )}
              </div>
              <div className="module-actions">
                <button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="module-primary" disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update employee' : 'Create employee & account')}</button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}

      {/* Rich Historical Data, Trend & Gap Evaluation Modal */}
      {history && (() => {
        const emp = history.employeeData || {}
        const rows = history.history || []
        
        // Compute trend changes if multiple records exist
        const firstRecord = rows[0] || {}
        const latestRecord = rows[rows.length - 1] || {}
        const perfDelta = rows.length > 1 ? (Number(latestRecord.performance_score || 0) - Number(firstRecord.performance_score || 0)) : 0
        const compDelta = rows.length > 1 ? (Number(latestRecord.competency_score || 0) - Number(firstRecord.competency_score || 0)) : 0
        const learnDelta = rows.length > 1 ? (Number(latestRecord.learning_progress || 0) - Number(firstRecord.learning_progress || 0)) : 0

        // Benchmark target is 80% standard
        const targetBenchmark = 80
        const currentPerf = Number(emp.performance_score ?? latestRecord.performance_score ?? 0)
        const currentComp = Number(emp.competency_score ?? latestRecord.competency_score ?? 0)
        const currentLearn = Number(emp.learning_progress ?? latestRecord.learning_progress ?? 0)
        
        const perfGap = currentPerf - targetBenchmark
        const compGap = currentComp - targetBenchmark

        // Prepare points for SVG chart (0 to 480 width, 20 to 140 height)
        const chartPoints = rows.map((r, idx) => {
          const x = rows.length === 1 ? 240 : (idx / (rows.length - 1)) * 440 + 20
          const yPerf = 140 - (Number(r.performance_score || 0) / 100) * 110
          const yComp = 140 - (Number(r.competency_score || 0) / 100) * 110
          const yLearn = 140 - (Number(r.learning_progress || 0) / 100) * 110
          return { x, yPerf, yComp, yLearn, r }
        })

        const perfPath = chartPoints.length > 1 
          ? chartPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPerf}`, '')
          : (chartPoints[0] ? `M 20 ${chartPoints[0].yPerf} L 460 ${chartPoints[0].yPerf}` : '')

        const compPath = chartPoints.length > 1 
          ? chartPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yComp}`, '')
          : (chartPoints[0] ? `M 20 ${chartPoints[0].yComp} L 460 ${chartPoints[0].yComp}` : '')

        const learnPath = chartPoints.length > 1 
          ? chartPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yLearn}`, '')
          : (chartPoints[0] ? `M 20 ${chartPoints[0].yLearn} L 460 ${chartPoints[0].yLearn}` : '')

        return createPortal(
          <div className="er-modal-backdrop" onClick={() => setHistory(null)}>
            <section className="settings-dialog er-dialog er-history-modal" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="er-history-header">
                <div className="er-history-user">
                  {emp?.avatar_url ? (
                    <img
                      src={emp.avatar_url}
                      alt={history.employee}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        display: 'block',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div className="er-history-avatar">{initials(history.employee)}</div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2>{history.employee}</h2>
                      <span className={`er-status ${emp.is_active ? 'active' : 'inactive'}`}>
                        {emp.is_active ? 'Active Employee' : 'Inactive'}
                      </span>
                    </div>
                    <p className="er-dialog-sub">
                      {emp.job_title || 'Hospitality Staff'} • {emp.department_name || emp.department || 'General Operations'} • {emp.employee_number || ''}
                    </p>
                  </div>
                </div>
                <button className="er-history-close" onClick={() => setHistory(null)} title="Close Modal">
                  <X size={18} />
                </button>
              </div>

              {/* Top Evaluation KPIs & Gap Summary */}
              <div className="er-history-kpis">
                <div className="er-history-kpi-card">
                  <div className="kpi-tag-label">Performance Score</div>
                  <div className="kpi-val-row">
                    <span className="kpi-big-val text-gray-900 dark:text-white">{currentPerf}%</span>
                    <span className={`kpi-trend-pill ${perfDelta > 0 ? 'positive' : perfDelta < 0 ? 'negative' : 'neutral'}`}>
                      {perfDelta > 0 ? <TrendingUp size={12} /> : perfDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      <span>{perfDelta > 0 ? `+${perfDelta}%` : perfDelta < 0 ? `${perfDelta}%` : 'Stable'}</span>
                    </span>
                  </div>
                  <div className="kpi-benchmark-sub">
                    {perfGap >= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Above standard benchmark (+{perfGap}%)</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">⚠ Gap: {perfGap}% below 80% benchmark</span>
                    )}
                  </div>
                </div>

                <div className="er-history-kpi-card">
                  <div className="kpi-tag-label">Competency Score</div>
                  <div className="kpi-val-row">
                    <span className="kpi-big-val text-blue-600 dark:text-blue-400">{currentComp}%</span>
                    <span className={`kpi-trend-pill ${compDelta > 0 ? 'positive' : compDelta < 0 ? 'negative' : 'neutral'}`}>
                      {compDelta > 0 ? <TrendingUp size={12} /> : compDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      <span>{compDelta > 0 ? `+${compDelta}%` : compDelta < 0 ? `${compDelta}%` : 'Stable'}</span>
                    </span>
                  </div>
                  <div className="kpi-benchmark-sub">
                    {compGap >= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Competency met (+{compGap}%)</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">⚠ Skill Gap: {compGap}% required focus</span>
                    )}
                  </div>
                </div>

                <div className="er-history-kpi-card">
                  <div className="kpi-tag-label">Learning Progress</div>
                  <div className="kpi-val-row">
                    <span className="kpi-big-val text-emerald-600 dark:text-emerald-400">{currentLearn}%</span>
                    <span className={`kpi-trend-pill ${learnDelta > 0 ? 'positive' : learnDelta < 0 ? 'negative' : 'neutral'}`}>
                      {learnDelta > 0 ? <TrendingUp size={12} /> : learnDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      <span>{learnDelta > 0 ? `+${learnDelta}%` : learnDelta < 0 ? `${learnDelta}%` : 'Stable'}</span>
                    </span>
                  </div>
                  <div className="kpi-benchmark-sub">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{currentLearn >= 100 ? '✓ All modules completed' : `${100 - currentLearn}% modules remaining`}</span>
                  </div>
                </div>
              </div>

              {/* Visual Historical Progression Graph */}
              <div className="er-chart-box">
                <div className="er-chart-top">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                      <BarChart3 size={14} className="text-gray-700" />
                      <span>Historical Progression &amp; Score Trends</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0">Time-series tracking recorded across performance workflows and reviews</p>
                  </div>
                  <div className="er-chart-legend">
                    <span className="legend-item"><span className="dot dot-perf" /> Performance</span>
                    <span className="legend-item"><span className="dot dot-comp" /> Competency</span>
                    <span className="legend-item"><span className="dot dot-learn" /> Learning</span>
                    <span className="legend-item"><span className="line-bench" /> 80% Benchmark</span>
                  </div>
                </div>

                <div className="er-svg-wrap">
                  <svg viewBox="0 0 480 160" className="er-timeline-svg" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="20" y1="30" x2="460" y2="30" stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    <line x1="20" y1="75" x2="460" y2="75" stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    <line x1="20" y1="120" x2="460" y2="120" stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    
                    {/* 80% Target Benchmark Line */}
                    <line x1="20" y1="52" x2="460" y2="52" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                    <text x="462" y="55" fill="#f59e0b" fontSize="8" fontWeight="600">80%</text>

                    {/* Path curves */}
                    {perfPath && <path d={perfPath} fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                    {compPath && <path d={compPath} fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                    {learnPath && <path d={learnPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Data Point Circles */}
                    {chartPoints.map((pt, idx) => (
                      <g key={idx}>
                        <circle cx={pt.x} cy={pt.yPerf} r="4" fill="#111827" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx={pt.x} cy={pt.yComp} r="4" fill="#111827" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx={pt.x} cy={pt.yLearn} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      </g>
                    ))}
                  </svg>
                  <div className="er-chart-dates">
                    {rows.map((r, i) => (
                      <span key={i} style={{ left: `${rows.length === 1 ? 50 : (i / (rows.length - 1)) * 90 + 5}%` }}>
                        {new Date(r.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance & Skill Gap Evaluation Box */}
              <div className="er-gap-eval-box">
                <div className="er-gap-eval-head">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100">
                    <Target size={14} className="text-rose-500" />
                    <span>Evaluated Competency &amp; Performance Gaps</span>
                  </div>
                  <span className="er-gap-badge-standard">Benchmark: 80.0% standard</span>
                </div>
                <div className="er-gap-grid">
                  <div className="er-gap-item">
                    <div className="gap-item-top">
                      <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-200">Role Competency Requirement</span>
                      <span className={`er-gap-tag ${compGap >= 0 ? 'ok' : 'risk'}`}>
                        {compGap >= 0 ? 'On Track' : `${Math.abs(compGap)}% Deficit`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 mb-2">
                      {compGap >= 0 
                        ? `${emp.full_name || 'Employee'} meets all baseline competencies required for ${emp.job_title || 'their role'}.`
                        : `Current capability is below expected benchmark. Training module assignments recommended in Learning Management.`}
                    </p>
                    <div className="er-progress-track">
                      <div className="er-progress-fill comp" style={{ width: `${Math.min(currentComp, 100)}%` }} />
                      <div className="benchmark-pin" style={{ left: '80%' }} title="Target standard: 80%" />
                    </div>
                  </div>

                  <div className="er-gap-item">
                    <div className="gap-item-top">
                      <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-200">Operational Performance Target</span>
                      <span className={`er-gap-tag ${perfGap >= 0 ? 'ok' : 'risk'}`}>
                        {perfGap >= 0 ? 'Exceeding Target' : `${Math.abs(perfGap)}% Deficit`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 mb-2">
                      {perfGap >= 0
                        ? `Operational delivery meets expected hotel guest service and departmental KPIs.`
                        : `Performance reviews indicate actionable areas for improvement before next evaluation cycle.`}
                    </p>
                    <div className="er-progress-track">
                      <div className="er-progress-fill perf" style={{ width: `${Math.min(currentPerf, 100)}%` }} />
                      <div className="benchmark-pin" style={{ left: '80%' }} title="Target standard: 80%" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Historical Logs Table */}
              <div className="er-history-table-section">
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-400" />
                  <span>Chronological Snapshot Logs ({rows.length})</span>
                </h4>
                {rows.length ? (
                  <div className="er-table-wrap er-history-table-wrap">
                    <table className="er-table">
                      <thead>
                        <tr>
                          <th>Recorded Date &amp; Time</th>
                          <th>Performance</th>
                          <th>Competency</th>
                          <th>Learning Progress</th>
                          <th>Evaluation Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice().reverse().map((row, idx) => {
                          const p = Number(row.performance_score || 0)
                          const c = Number(row.competency_score || 0)
                          const isCompliant = p >= 80 && c >= 80
                          return (
                            <tr key={row.id || idx}>
                              <td>
                                <div className="font-semibold text-[10.5px]">
                                  {new Date(row.recorded_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                                <small className="text-slate-400 text-[9px]">{new Date(row.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                              </td>
                              <td><span className="er-score text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30">{p}%</span></td>
                              <td><span className="er-score text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">{c}%</span></td>
                              <td><span className="er-score text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30">{row.learning_progress || 0}%</span></td>
                              <td>
                                <span className={`er-status ${isCompliant ? 'active' : 'inactive'}`}>
                                  {isCompliant ? 'Standards Met' : 'Gap Intervention Needed'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="er-empty">No historical snapshots recorded yet for this employee.</p>
                )}
              </div>

              {/* Footer Actions */}
              <div className="module-actions" style={{ marginTop: 18, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 12 }}>
                <button className="cancel-button" onClick={() => setHistory(null)}>Close Evaluation</button>
              </div>
            </section>
          </div>,
          document.body
        )
      })()}

      {/* Invite modal */}
      {inviteOpen && createPortal(
        <div className="er-modal-backdrop" onClick={() => setInviteOpen(false)}>
          <section className="settings-dialog er-dialog" onClick={e => e.stopPropagation()}>
            <h2>Send invitation</h2>
            <p className="er-dialog-sub">The user receives a registration link valid for 7 days.</p>
            <form onSubmit={sendInvite}>
              <div className="er-form-grid">
                <label>Full name<input value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })} required /></label>
                <label>Email<input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required /></label>
                <label>Role<select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>Department<select value={inviteForm.departmentId} onChange={e => setInviteForm({ ...inviteForm, departmentId: e.target.value })}>
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
              </div>
              <div className="module-actions">
                <button type="button" className="cancel-button" onClick={() => setInviteOpen(false)}>Cancel</button>
                <button className="module-primary" disabled={saving}>{saving ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}
    </main>
  )
}
