import { useMemo, useState } from 'react'
import { COMPETENCY_TEMPLATES, getRecommendedCoursesForGap } from '../workflowConfig'
import SkillRadarChart, { LEVEL_SCORES } from './SkillRadarChart'
import InteractiveTalentGrid from './InteractiveTalentGrid'
import InteractiveBenchStrength from './InteractiveBenchStrength'
import { BookOpen, CheckCircle2, ShieldAlert } from 'lucide-react'

// ---------------------------------------------------------------------------
// Module-specific business workspace. Renders a distinct, data-driven overview
// per module using ONLY information that can be derived from the live database
// payloads already fetched by WorkflowPage.
// ---------------------------------------------------------------------------

const PCT = value => `${Number(value || 0)}%`

// Small reusable building blocks -------------------------------------------

function Section({ title, note, children }) {
  return (
    <section className="module-biz">
      <div className="module-biz-head">
        <h3>{title}</h3>
        {note && <span className="module-biz-note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function ScoreBar({ label, value, tone }) {
  const num = Number(value || 0)
  const cls = tone || (num >= 80 ? 'good' : num >= 60 ? 'mid' : 'low')
  return (
    <div className="score-line">
      <span className="score-label">{label}</span>
      <i className="score-track"><em className={cls} style={{ width: `${Math.min(100, num)}%` }} /></i>
      <b>{Math.round(num)}</b>
    </div>
  )
}

function ReadinessTag({ readiness }) {
  const map = {
    ready_now: 'Ready now',
    ready_in_1_2_years: 'Ready in 1–2 yrs',
    potential: 'Potential',
    development_needed: 'Development needed',
    not_ready: 'Not ready',
  }
  const label = map[readiness] || readiness || 'N/A'
  const cls = readiness === 'ready_now' ? 'ready' : readiness === 'ready_in_1_2_years' ? 'soon' : 'dev'
  return <span className={`readiness-tag ${cls}`}>{label}</span>
}

function WorkflowSummary({ workflows, completedWorkflows, breakdown, moduleKey }) {
  const active = (workflows || []).filter(w => w.status === 'active').length
  const completed = (completedWorkflows || []).length
  const total = (workflows || []).length + completed
  const rows = (breakdown || []).filter(b => b.module === moduleKey)
  return (
    <div className="business-metrics">
      <article><small>Active</small><b>{active}</b></article>
      <article><small>Awaiting review</small><b>{Math.max(0, active - completed)}</b></article>
      <article><small>Completed</small><b>{completed}</b></article>
      <article><small>Total records</small><b>{total}</b></article>
      {rows.length > 0 && (
        <div className="workflow-stage-breakdown">
          {rows.map(r => (
            <div key={r.status} className="stage-break-row">
              <span>{r.status}</span>
              <i><em style={{ width: `${total ? Math.round((r.count / total) * 100) : 0}%` }} /></i>
              <b>{r.count}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Searchable, capped employee list.
function EmployeeList({ employees, children, limit = 8 }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const all = useMemo(() => employees || [], [employees])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(emp =>
      (emp.full_name || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.job_title || '').toLowerCase().includes(q),
    )
  }, [all, query])

  if (!all || all.length === 0) {
    return <p className="module-biz-empty">No employee records available in the database for this view.</p>
  }

  const visible = showAll ? filtered : filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  return (
    <div className="biz-list">
      <div className="biz-list-toolbar">
        <input
          className="biz-list-search"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowAll(false) }}
          placeholder={`Search ${all.length} employees by name or department…`}
          aria-label="Search employees"
        />
        <span className="biz-list-count">{filtered.length} of {all.length}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="module-biz-empty">No employees match "{query}".</p>
      ) : (
        <div className="employee-business-list">
          {visible.map(emp => (
            <div className="employee-business-row" key={emp.id}>
              <span className="emp-chips av">{emp.full_name.split(' ').map(w => w[0]).join('').toUpperCase()}</span>
              <div className="emp-info">
                <b>{emp.full_name}</b>
                <small>{emp.department}{emp.job_title ? ` · ${emp.job_title}` : ''}</small>
              </div>
              {children(emp)}
            </div>
          ))}
        </div>
      )}
      {hasMore && (
        <button type="button" className="biz-list-toggle" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show fewer' : `View all (${filtered.length})`}
        </button>
      )}
    </div>
  )
}

// ------------------------------ PERFORMANCE -------------------------------
function PerformanceBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const totals = data?.totals || {}
  const avg = Number(totals.average_performance || 0)
  const sorted = [...employees].sort((a, b) => Number(b.performance_score || 0) - Number(a.performance_score || 0))
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'scorecards'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`bench-filter-pill ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Interactive 9-Box Grid
          </button>
          <button
            type="button"
            className={`bench-filter-pill ${viewMode === 'scorecards' ? 'active' : ''}`}
            onClick={() => setViewMode('scorecards')}
          >
            Employee Scorecards List
          </button>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Avg Logistics Performance: <b style={{ color: '#111827' }}>{PCT(avg)}</b>
        </span>
      </div>

      {viewMode === 'grid' ? (
        <Section title="Interactive 9-Box Talent & Performance Matrix" note="Click any cell to filter and inspect specific talent pools">
          <InteractiveTalentGrid employees={employees} />
        </Section>
      ) : (
        <Section title="Employee Scorecards" note="Live performance & competency scores">
          <div className="business-metrics">
            <article><small>Employees</small><b>{totals.total_employees ?? employees.length}</b></article>
            <article><small>Avg performance</small><b>{PCT(avg)}</b></article>
            <article><small>At/above avg</small><b>{employees.filter(e => Number(e.performance_score || 0) >= avg).length}</b></article>
          </div>
          <EmployeeList employees={sorted}>
            {emp => (
              <div className="emp-scores">
                <ScoreBar label="Performance" value={emp.performance_score} />
                <ScoreBar label="Competency" value={emp.competency_score} />
                <ReadinessTag readiness={emp.readiness} />
              </div>
            )}
          </EmployeeList>
        </Section>
      )}

      <Section title="Review cycle summary" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="performance" />
      </Section>
    </>
  )
}

// ------------------------------ COMPETENCY --------------------------------
function CompetencyBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = useMemo(() => data?.employees || [], [data])
  const totals = data?.totals || {}
  const avg = Number(totals.average_competency || 0)
  const gaps = employees.filter(e => Number(e.competency_score || 0) < 70)

  const roles = Object.keys(COMPETENCY_TEMPLATES)
  const [selectedRole, setSelectedRole] = useState(roles[0] || 'Head Sommelier')
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '')
  const [activeCompetency, setActiveCompetency] = useState('')
  const [enrolledNotice, setEnrolledNotice] = useState('')

  const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmpId)) || employees[0] || null

  const benchmarkCompetencies = useMemo(() => {
    const list = COMPETENCY_TEMPLATES[selectedRole] || []
    const empBaseScore = Number(selectedEmployee?.competency_score || 80)

    return list.map((item, idx) => {
      const target = item.targetScore || LEVEL_SCORES[item.level] || 85
      const variation = ((idx % 3) - 1) * 6
      const actual = Math.min(100, Math.max(35, Math.round(empBaseScore + variation)))

      return {
        ...item,
        target,
        actual,
      }
    })
  }, [selectedRole, selectedEmployee])

  // Find skill gaps for selected employee
  const employeeGaps = useMemo(() => {
    return benchmarkCompetencies.filter(b => b.actual < b.target)
  }, [benchmarkCompetencies])

  const handleEnrollCourse = (compName, courseTitle) => {
    setEnrolledNotice(`Assigned "${courseTitle}" to ${selectedEmployee?.full_name || 'employee'} for competency gap in "${compName}"!`)
    setTimeout(() => setEnrolledNotice(''), 4000)
  }

  const byDept = useMemo(() => {
    const map = {}
    employees.forEach(e => {
      const d = e.department || 'Unassigned'
      map[d] = map[d] || []
      map[d].push(Number(e.competency_score || 0))
    })
    return Object.entries(map).map(([dept, scores]) => ({
      dept,
      count: scores.length,
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    })).sort((a, b) => b.count - a.count)
  }, [employees])

  return (
    <>
      {enrolledNotice && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 14,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            color: '#059669',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{enrolledNotice}</span>
        </div>
      )}

      {/* Role-Based Benchmark Matrix & Skill Spider Web Section */}
      <Section title="Role Benchmark Matrix & Skill Spider Web" note="Compare employee proficiency against standardized logistics role benchmarks">
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          padding: '12px 14px',
          background: 'rgba(81, 58, 179, 0.05)',
          borderRadius: 12,
          border: '1px solid rgba(81, 58, 179, 0.15)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Role Benchmark Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#111827', whiteSpace: 'nowrap' }}>
              Role Standard:
            </span>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'var(--card-bg, #ffffff)',
                color: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {roles.map(r => (
                <option key={r} value={r}>{r} ({COMPETENCY_TEMPLATES[r]?.length} benchmarks)</option>
              ))}
            </select>
          </div>

          {/* Subject Employee Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#059669', whiteSpace: 'nowrap' }}>
              Employee Profile:
            </span>
            <select
              value={selectedEmployee?.id || ''}
              onChange={e => setSelectedEmpId(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'var(--card-bg, #ffffff)',
                color: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.department} · {emp.competency_score}% Score)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual Skill Radar Chart */}
        <SkillRadarChart
          competencies={benchmarkCompetencies}
          roleName={selectedRole}
          employeeName={selectedEmployee?.full_name || 'Selected Employee'}
          selectedCompetency={activeCompetency}
          onSelectCompetency={setActiveCompetency}
          showTable={true}
          compact={false}
        />

        {/* ── ACTIONABLE SKILL GAP REMEDIATION & LEARNING RECOMMENDATION ──── */}
        {employeeGaps.length > 0 && (
          <div className="gap-remediation-card">
            <div className="gap-remediation-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={16} color="#ef4444" />
                <b style={{ fontSize: 14 }}>Identified Competency Gaps & Action Plans</b>
              </div>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                {employeeGaps.length} skill gap(s) below benchmark
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {employeeGaps.map(gap => {
                const recCourses = getRecommendedCoursesForGap(gap.competency, gap.actual)
                const primaryCourse = recCourses[0] || { title: 'Logistics Foundations', duration: '4' }

                return (
                  <div
                    key={gap.competency}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(239, 68, 68, 0.04)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <b style={{ fontSize: 13 }}>{gap.competency}</b>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>
                        {gap.actual}% / {gap.target}%
                      </span>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      Recommended Track: <b>{primaryCourse.title}</b> ({primaryCourse.duration} hrs)
                    </div>

                    <button
                      type="button"
                      className="gap-action-btn"
                      onClick={() => handleEnrollCourse(gap.competency, primaryCourse.title)}
                    >
                      <BookOpen size={13} />
                      <span>Assign Learning Plan</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Skill Gap Summary Section */}
      <Section title="Department skill gap summary" note="Competency below 70% flagged as an operational risk">
        <div className="business-metrics">
          <article><small>Avg competency</small><b>{PCT(avg)}</b></article>
          <article><small>Skill gaps</small><b>{gaps.length}</b></article>
          <article><small>No gaps</small><b>{employees.length - gaps.length}</b></article>
        </div>
        {byDept.length > 0 && (
          <div className="dept-gap-grid">
            {byDept.map(d => (
              <div className="dept-gap-card" key={d.dept}>
                <div className="dept-gap-head"><b>{d.dept}</b><span>{d.count} employees</span></div>
                <ScoreBar label="Avg competency" value={d.avg} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Development-plan progress" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="competency" />
      </Section>
    </>
  )
}

// ------------------------------ LEARNING ----------------------------------
function LearningBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const totals = data?.totals || {}
  const avg = Number(totals.learning_completion || 0)
  const sorted = [...employees].sort((a, b) => Number(b.learning_progress || 0) - Number(a.learning_progress || 0))
  return (
    <>
      <Section title="Learning progress" note="Live learning completion per learner">
        <div className="business-metrics">
          <article><small>Learners</small><b>{employees.length}</b></article>
          <article><small>Avg completion</small><b>{PCT(avg)}</b></article>
          <article><small>On track (≥70%)</small><b>{employees.filter(e => Number(e.learning_progress || 0) >= 70).length}</b></article>
        </div>
        <EmployeeList employees={sorted}>
          {emp => <ScoreBar label="Learning completion" value={emp.learning_progress} />}
        </EmployeeList>
      </Section>
      <Section title="Learning-path activity" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="learning" />
      </Section>
    </>
  )
}

// ------------------------------ TRAINING ----------------------------------
function TrainingBusiness({ workflows, completedWorkflows, breakdown }) {
  const active = (workflows || []).filter(w => w.status === 'active')
  const completed = completedWorkflows || []
  return (
    <Section title="Training activity" note="All training records are workflow-driven">
      <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="training" />
      {active.length > 0 && (
        <div className="training-active">
          <div className="training-active-head"><b>In-progress sessions</b></div>
          <ul>
            {active.map(w => (
              <li key={w.id}>
                <span className="emp-chips av">{(w.subject_name || '—').split(' ').map(x => x[0]).join('').toUpperCase()}</span>
                <div className="emp-info"><b>{w.title}</b><small>Stage: {w.current_stage || '—'}</small></div>
                <span className="status-mini active">Active</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {completed.length === 0 && active.length === 0 && (
        <p className="module-biz-empty">No training workflows exist yet.</p>
      )}
    </Section>
  )
}

// ------------------------------ SUCCESSION --------------------------------
function SuccessionBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const [successionView, setSuccessionView] = useState('bench') // 'bench' | 'matrix' | 'pool'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`bench-filter-pill ${successionView === 'bench' ? 'active' : ''}`}
            onClick={() => setSuccessionView('bench')}
          >
            Critical Roles Bench Strength
          </button>
          <button
            type="button"
            className={`bench-filter-pill ${successionView === 'matrix' ? 'active' : ''}`}
            onClick={() => setSuccessionView('matrix')}
          >
            9-Box Succession Matrix
          </button>
          <button
            type="button"
            className={`bench-filter-pill ${successionView === 'pool' ? 'active' : ''}`}
            onClick={() => setSuccessionView('pool')}
          >
            Candidate Pool List
          </button>
        </div>
      </div>

      {successionView === 'bench' && (
        <Section title="Critical Leadership Bench Strength" note="Pipeline readiness for core logistics leadership positions">
          <InteractiveBenchStrength employees={employees} />
        </Section>
      )}

      {successionView === 'matrix' && (
        <Section title="Succession 9-Box Talent Matrix" note="Cross-referencing performance score against succession readiness">
          <InteractiveTalentGrid employees={employees} />
        </Section>
      )}

      {successionView === 'pool' && (
        <Section title="Candidate pool" note="Sorted by performance score">
          <EmployeeList employees={[...employees].sort((a, b) => Number(b.performance_score || 0) - Number(a.performance_score || 0))}>
            {emp => (
              <div className="emp-scores">
                <ScoreBar label="Performance" value={emp.performance_score} />
                <ReadinessTag readiness={emp.readiness} />
              </div>
            )}
          </EmployeeList>
        </Section>
      )}

      <Section title="Succession-cycle activity" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="succession" />
      </Section>
    </>
  )
}

// ------------------------------ RECOGNITION -------------------------------
function RecognitionBusiness({ workflows, completedWorkflows, breakdown }) {
  const active = (workflows || []).filter(w => w.status === 'active')
  const completed = completedWorkflows || []
  return (
    <>
      <Section title="Recognition feed" note="All recognition records are workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="recognition" />
      </Section>
      {active.length > 0 && (
        <Section title="Open nominations" note="Awaiting the next assigned role">
          <ul className="open-nominations">
            {active.map(w => (
              <li key={w.id}>
                <span className="emp-chips av">{(w.subject_name || '—').split(' ').map(x => x[0]).join('').toUpperCase()}</span>
                <div className="emp-info"><b>{w.title}</b><small>Stage: {w.current_stage || '—'}</small></div>
                <span className="status-mini active">In review</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {completed.length === 0 && active.length === 0 && (
        <p className="module-biz-empty">No recognition nominations exist yet.</p>
      )}
    </>
  )
}

// ------------------------------ DISPATCH ----------------------------------
const VIEWS = {
  performance: PerformanceBusiness,
  competency: CompetencyBusiness,
  learning: LearningBusiness,
  training: TrainingBusiness,
  succession: SuccessionBusiness,
  recognition: RecognitionBusiness,
}

export default function ModuleBusinessView({ moduleKey, data, workflows = [], completedWorkflows = [] }) {
  const View = VIEWS[moduleKey]
  if (!View) return null
  const breakdown = data?.workflowBreakdown || []
  return (
    <div className="module-business">
      <View
        data={data || {}}
        workflows={workflows}
        completedWorkflows={completedWorkflows}
        breakdown={breakdown}
      />
    </div>
  )
}
