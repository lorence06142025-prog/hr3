import { useState, useMemo } from 'react'
import {
  Crown,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react'

const CRITICAL_POSITIONS = [
  {
    role: 'Hotel General Manager',
    department: 'Executive Office',
    incumbent: 'Noah Santos',
    incumbentTitle: 'General Manager & Director',
    riskLevel: 'Low',
  },
  {
    role: 'Executive Chef',
    department: 'Kitchen',
    incumbent: 'Marco Rossi',
    incumbentTitle: 'Executive Chef',
    riskLevel: 'Medium',
  },
  {
    role: 'Director of Food & Beverage',
    department: 'Food & Beverage',
    incumbent: 'Elena Rostova',
    incumbentTitle: 'F&B Director',
    riskLevel: 'High',
  },
  {
    role: 'Front Office Manager',
    department: 'Front Office',
    incumbent: 'David Miller',
    incumbentTitle: 'Head of Guest Services',
    riskLevel: 'Low',
  },
  {
    role: 'Executive Housekeeper',
    department: 'Housekeeping',
    incumbent: 'Clara Vance',
    incumbentTitle: 'Executive Housekeeper',
    riskLevel: 'Medium',
  },
  {
    role: 'Director of Human Resources',
    department: 'Human Resources',
    incumbent: 'Ava Reyes',
    incumbentTitle: 'HR Administrator',
    riskLevel: 'Low',
  },
]

export default function InteractiveBenchStrength({ employees = [], onSelectCandidate }) {
  const dynamicPositions = useMemo(() => {
    return CRITICAL_POSITIONS.map(pos => {
      // Find real matching incumbent from database employees in this department
      const match = employees.find(e =>
        e.department?.toLowerCase() === pos.department.toLowerCase() &&
        (e.job_title?.toLowerCase().includes('manager') ||
         e.job_title?.toLowerCase().includes('director') ||
         e.job_title?.toLowerCase().includes('chef') ||
         e.job_title?.toLowerCase().includes('head') ||
         e.job_title?.toLowerCase().includes('supervisor'))
      ) || employees.find(e => e.department?.toLowerCase() === pos.department.toLowerCase())

      return {
        ...pos,
        incumbent: match ? match.full_name : pos.incumbent,
        incumbentTitle: match ? match.job_title : pos.incumbentTitle,
      }
    })
  }, [employees])

  const [selectedRole, setSelectedRole] = useState(CRITICAL_POSITIONS[0].role)
  const [readinessFilter, setReadinessFilter] = useState('ALL')

  // Group active employees by succession readiness
  const successorsByRole = useMemo(() => {
    const map = {}
    dynamicPositions.forEach((pos) => {
      // Find candidates in same or related department, or high performers
      const candidates = employees.filter((e) => {
        if (e.full_name === pos.incumbent) return false
        const isSameDept = e.department === pos.department
        const isHighPerf = Number(e.performance_score || 0) >= 80
        return isSameDept || isHighPerf
      })

      const readyNow = candidates.filter((e) => e.readiness === 'ready_now' || (Number(e.performance_score || 0) >= 88 && Number(e.competency_score || 0) >= 86))
      const ready1to2 = candidates.filter((e) => e.readiness === 'ready_in_1_2_years' || (!readyNow.includes(e) && (Number(e.performance_score || 0) >= 80 || Number(e.competency_score || 0) >= 80)))
      const devNeeded = candidates.filter((e) => !readyNow.includes(e) && !ready1to2.includes(e))

      let benchStatus = 'Vulnerable'
      let statusColor = '#ef4444'
      if (readyNow.length >= 2) {
        benchStatus = 'Strong Bench'
        statusColor = '#10b981'
      } else if (readyNow.length === 1 || ready1to2.length >= 2) {
        benchStatus = 'Moderate'
        statusColor = '#f59e0b'
      }

      map[pos.role] = {
        ...pos,
        readyNow,
        ready1to2,
        devNeeded,
        totalSuccessors: readyNow.length + ready1to2.length + devNeeded.length,
        benchStatus,
        statusColor,
      }
    })
    return map
  }, [dynamicPositions, employees])

  const activePositionData = successorsByRole[selectedRole] || successorsByRole[dynamicPositions[0]?.role]

  return (
    <div className="bench-strength-container">
      {/* ── TOP HEADER / BENCH OVERVIEW CARDS ────────────────────────────────── */}
      <div className="bench-roles-grid">
        {dynamicPositions.map((pos) => {
          const data = successorsByRole[pos.role]
          const isSelected = selectedRole === pos.role

          return (
            <div
              key={pos.role}
              className={`bench-role-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedRole(pos.role)}
            >
              <div className="bench-card-top">
                <span className="bench-role-dept">{pos.department}</span>
                <span
                  className="bench-status-badge"
                  style={{ color: data.statusColor, backgroundColor: `${data.statusColor}18`, borderColor: `${data.statusColor}40` }}
                >
                  {data.statusColor === '#10b981' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                  <span>{data.benchStatus}</span>
                </span>
              </div>

              <div className="bench-role-title">{pos.role}</div>
              <div className="bench-incumbent-line">
                Current: <b>{pos.incumbent}</b>
              </div>

              <div className="bench-counts-row">
                <div className="bench-count-item">
                  <span>Ready Now</span>
                  <b style={{ color: '#10b981' }}>{data.readyNow.length}</b>
                </div>
                <div className="bench-count-item">
                  <span>1–2 Yrs</span>
                  <b style={{ color: '#f59e0b' }}>{data.ready1to2.length}</b>
                </div>
                <div className="bench-count-item">
                  <span>Developing</span>
                  <b style={{ color: '#64748b' }}>{data.devNeeded.length}</b>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ACTIVE ROLE SUCCESSION PIPELINE ─────────────────────────────────── */}
      <div className="bench-pipeline-card">
        <div className="bench-pipeline-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crown size={18} color="#111827" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {activePositionData.role} — Succession Pipeline
              </h3>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Department: <b>{activePositionData.department}</b> • Incumbent: <b>{activePositionData.incumbent}</b>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'ready_now', 'ready_1_2', 'dev'].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`bench-filter-pill ${readinessFilter === filterKey ? 'active' : ''}`}
                onClick={() => setReadinessFilter(filterKey)}
              >
                {filterKey === 'ALL' && 'All Tiers'}
                {filterKey === 'ready_now' && `Ready Now (${activePositionData.readyNow.length})`}
                {filterKey === 'ready_1_2' && `1-2 Years (${activePositionData.ready1to2.length})`}
                {filterKey === 'dev' && `Developing (${activePositionData.devNeeded.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="bench-tiers-container">
          {/* TIER 1: READY NOW */}
          {(readinessFilter === 'ALL' || readinessFilter === 'ready_now') && (
            <div className="bench-tier-section tier-emerald">
              <div className="bench-tier-label">
                <span className="tier-badge emerald">Ready Now (0–6 Months)</span>
                <span className="tier-subtext">{activePositionData.readyNow.length} qualified candidate(s)</span>
              </div>
              {activePositionData.readyNow.length === 0 ? (
                <div className="bench-empty-tier">No immediate successors identified. High vacancy risk.</div>
              ) : (
                <div className="bench-candidates-grid">
                  {activePositionData.readyNow.map((c) => (
                    <div
                      key={c.id}
                      className="bench-candidate-item"
                      onClick={() => onSelectCandidate && onSelectCandidate(c)}
                    >
                      <div className="bench-candidate-av">
                        {c.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bench-candidate-body">
                        <b>{c.full_name}</b>
                        <small>{c.job_title} • {c.department}</small>
                        <div className="bench-scores-strip">
                          <span>Perf: <b>{c.performance_score}%</b></span>
                          <span>Comp: <b>{c.competency_score}%</b></span>
                        </div>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TIER 2: READY IN 1-2 YEARS */}
          {(readinessFilter === 'ALL' || readinessFilter === 'ready_1_2') && (
            <div className="bench-tier-section tier-amber">
              <div className="bench-tier-label">
                <span className="tier-badge amber">Ready in 1–2 Years</span>
                <span className="tier-subtext">{activePositionData.ready1to2.length} candidate(s) in active training</span>
              </div>
              {activePositionData.ready1to2.length === 0 ? (
                <div className="bench-empty-tier">No intermediate succession candidates in pipeline.</div>
              ) : (
                <div className="bench-candidates-grid">
                  {activePositionData.ready1to2.map((c) => (
                    <div
                      key={c.id}
                      className="bench-candidate-item"
                      onClick={() => onSelectCandidate && onSelectCandidate(c)}
                    >
                      <div className="bench-candidate-av">
                        {c.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bench-candidate-body">
                        <b>{c.full_name}</b>
                        <small>{c.job_title} • {c.department}</small>
                        <div className="bench-scores-strip">
                          <span>Perf: <b>{c.performance_score}%</b></span>
                          <span>Comp: <b>{c.competency_score}%</b></span>
                        </div>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TIER 3: DEVELOPMENT NEEDED */}
          {(readinessFilter === 'ALL' || readinessFilter === 'dev') && (
            <div className="bench-tier-section tier-slate">
              <div className="bench-tier-label">
                <span className="tier-badge slate">Development Track (2+ Years)</span>
                <span className="tier-subtext">{activePositionData.devNeeded.length} emerging talent(s)</span>
              </div>
              {activePositionData.devNeeded.length === 0 ? (
                <div className="bench-empty-tier">No pipeline candidates assigned to long-term track.</div>
              ) : (
                <div className="bench-candidates-grid">
                  {activePositionData.devNeeded.slice(0, 6).map((c) => (
                    <div
                      key={c.id}
                      className="bench-candidate-item"
                      onClick={() => onSelectCandidate && onSelectCandidate(c)}
                    >
                      <div className="bench-candidate-av">
                        {c.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bench-candidate-body">
                        <b>{c.full_name}</b>
                        <small>{c.job_title} • {c.department}</small>
                        <div className="bench-scores-strip">
                          <span>Perf: <b>{c.performance_score}%</b></span>
                          <span>Comp: <b>{c.competency_score}%</b></span>
                        </div>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
