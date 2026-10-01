import React, { useCallback, useEffect, useState } from 'react'
import WorkflowPage from '../components/WorkflowPage'
import { api } from '../lib/api'
import '../learningLibrary.css'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Target, BookOpen } from 'lucide-react'

// ---------------------------------------------------------------------------
// Competency Management page — wraps the shared WorkflowPage with a live
// "Skill Gap Learning Progress" panel that cross-links Competency → Learning.
// ---------------------------------------------------------------------------

function SkillGapProgressPanel() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}') } catch { return {} } })()
  const isHr = user.role === 'hr'
  const isSupervisor = user.role === 'supervisor'
  const isEmployee = user.role === 'employee'

  const [open, setOpen] = useState(true)
  const [employees, setEmployees] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [gaps, setGaps] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load employee list (HR/supervisor only)
  useEffect(() => {
    if (isEmployee) return
    api.workflowSubjects().catch(() => ({ employees: [] })).then(res => {
      setEmployees(res.employees || [])
    })
  }, [isEmployee])

  // Load gaps + assignments for selected employee (or self for employee role)
  const loadData = useCallback(async (empId) => {
    const targetId = empId || (isEmployee ? user.employeeId : null)
    if (!targetId) { setGaps([]); setAssignments([]); return }
    setLoading(true)
    setError('')
    try {
      const [gapRes, assignRes] = await Promise.all([
        api.learningSkillGaps({ employeeId: targetId }),
        api.learningAssignments(),
      ])
      setGaps(gapRes.skillGaps || gapRes.gaps || [])
      setAssignments(assignRes.assignments || [])
    } catch (err) {
      setError(err.message || 'Could not load skill gap data.')
    } finally {
      setLoading(false)
    }
  }, [isEmployee, user.employeeId])

  useEffect(() => {
    if (isEmployee) {
      loadData(null)
    } else if (selectedEmpId) {
      loadData(selectedEmpId)
    } else {
      setGaps([])
      setAssignments([])
    }
  }, [selectedEmpId, isEmployee, loadData])

  const getStatusMeta = (gap) => {
    if (gap <= 0)  return { cls: 'sgp-badge sgp-badge--ok',       label: 'On Track'     }
    if (gap <= 10) return { cls: 'sgp-badge sgp-badge--minor',    label: 'Minor Gap'    }
    if (gap <= 20) return { cls: 'sgp-badge sgp-badge--gap',      label: 'Gap'          }
    return           { cls: 'sgp-badge sgp-badge--critical', label: 'Critical Gap' }
  }

  const getLinkedAssignment = (competency) => {
    return assignments.find(a =>
      (a.competencies || []).some(c => c.toLowerCase() === competency.toLowerCase()) ||
      a.resource_title?.toLowerCase().includes(competency.toLowerCase().split(' ')[0])
    )
  }

  if (!isHr && !isSupervisor && !isEmployee) return null

  return (
    <div className="sgp-panel">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="sgp-header"
        style={{ borderBottom: open ? undefined : 'none' }}
      >
        <span className="sgp-title">
          <Target size={16} className="sgp-title-icon" />
          Skill Gap Learning Progress
          <span className="sgp-live-badge">Live Cross-Module View</span>
        </span>
        {open ? <ChevronUp size={16} className="sgp-title-icon" /> : <ChevronDown size={16} className="sgp-title-icon" />}
      </button>

      {open && (
        <div className="sgp-body">
          {/* Employee selector (HR/Supervisor) */}
          {!isEmployee && (
            <div className="sgp-selector-row">
              <label className="sgp-selector-label">View Skill Gaps For:</label>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="sgp-select"
              >
                <option value="">— Select an employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.job_title} · {emp.department})
                  </option>
                ))}
              </select>
              {selectedEmpId && gaps.length > 0 && (
                <span className="sgp-gap-count">
                  {gaps.length} gap{gaps.length > 1 ? 's' : ''} detected
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="sgp-error">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="sgp-loading">
              Analyzing skill gaps and linked courses…
            </div>
          )}

          {/* Empty state — all on track */}
          {!loading && !error && gaps.length === 0 && (selectedEmpId || isEmployee) && (
            <div className="sgp-empty">
              <CheckCircle size={24} className="sgp-empty-icon" />
              <p className="sgp-empty-title">All Competencies On Track</p>
              <p className="sgp-empty-sub">No skill gaps detected. Keep developing!</p>
            </div>
          )}

          {/* No employee selected */}
          {!loading && !error && !isEmployee && !selectedEmpId && (
            <p className="sgp-hint">
              Select an employee above to view their competency gaps and linked learning progress.
            </p>
          )}

          {/* Gap table */}
          {!loading && gaps.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="sgp-table">
                <thead>
                  <tr className="sgp-thead-row">
                    {['Competency', 'Current', 'Required', 'Gap', 'Status', 'Linked Course', 'Progress'].map(h => (
                      <th key={h} className="sgp-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g, idx) => {
                    const st = getStatusMeta(g.gap)
                    const linked = getLinkedAssignment(g.competency)
                    const progress = linked ? (Number(linked.progress) || 0) : null
                    const verified = linked?.is_completed
                    const barColor = verified ? '#10b981' : progress >= 75 ? '#111827' : progress >= 40 ? '#f59e0b' : '#94a3b8'
                    return (
                      <tr key={idx} className="sgp-row">
                        <td className="sgp-td sgp-td--name">{g.competency}</td>
                        <td className="sgp-td sgp-td--muted">{g.score}%</td>
                        <td className="sgp-td sgp-td--muted">{g.required_score}%</td>
                        <td className="sgp-td">
                          <span style={{ fontWeight: 700, color: g.gap > 0 ? '#dc2626' : '#059669' }}>
                            {g.gap > 0 ? `-${g.gap}%` : '✓'}
                          </span>
                        </td>
                        <td className="sgp-td">
                          <span className={st.cls}>{st.label}</span>
                        </td>
                        <td className="sgp-td" style={{ maxWidth: 180 }}>
                          {linked ? (
                            <span className="sgp-course-link">
                              <BookOpen size={11} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linked.resource_title}</span>
                            </span>
                          ) : (
                            <span className="sgp-not-assigned">Not assigned yet</span>
                          )}
                        </td>
                        <td className="sgp-td" style={{ minWidth: 110 }}>
                          {linked && progress !== null ? (
                            <div>
                              <div className="sgp-bar-label">
                                <span>{verified ? '✓ Verified' : `${progress}%`}</span>
                                {linked.status && !verified && <span style={{ textTransform: 'capitalize' }}>{linked.status.replace('_', ' ')}</span>}
                              </div>
                              <div className="sgp-bar-track">
                                <div className="sgp-bar-fill" style={{
                                  width: `${verified ? 100 : progress}%`,
                                  background: barColor,
                                }} />
                              </div>
                            </div>
                          ) : (
                            <span className="sgp-not-assigned">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          {!loading && gaps.length > 0 && (
            <div className="sgp-legend">
              {[
                { cls: 'sgp-badge sgp-badge--ok',       label: 'On Track'       },
                { cls: 'sgp-badge sgp-badge--minor',    label: 'Minor Gap (≤10%)' },
                { cls: 'sgp-badge sgp-badge--gap',      label: 'Gap (11–20%)'   },
                { cls: 'sgp-badge sgp-badge--critical', label: 'Critical (>20%)' },
              ].map(s => (
                <span key={s.label} className="sgp-legend-item">
                  <em className={`${s.cls} sgp-legend-swatch`} />
                  <span className="sgp-legend-label">{s.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompetencyManagement() {
  return (
    <div>
      <div className="sgp-wrapper">
        <SkillGapProgressPanel />
      </div>
      <WorkflowPage
        module="competency"
        title="Skill development"
        description="Manage the competency and development-plan actions assigned to your role."
        action={{ hr: 'Create development plan' }}
        stages={[
          ["Define competency requirements", "Define hospitality competency requirements and development objectives.", ["hr"]],
          ["Assign development plan", "Review detected skill gaps, pick recommended learning courses, and assign learning paths.", ["hr", "supervisor"]],
          ["Track learning progress", "Review assigned learning and development progress.", ["employee", "supervisor"]],
          ["Update competency record", "Update competency records and analytics.", ["hr"]],
        ]}
        items={[]}
        itemLabel="Development plan"
        itemIsEmployee
      />
    </div>
  )
}
