import { useState, useMemo } from 'react'
import {
  Crown,
  Star,
  Zap,
  TrendingUp,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertCircle,
  Filter,
  X,
} from 'lucide-react'

// Standard 9-Box Definitions for Performance vs. Potential
const NINE_BOX_MATRIX = [
  // Top Row (High Potential)
  {
    id: 'enigma',
    row: 0,
    col: 0,
    title: 'Enigma / Emerging',
    shortLabel: 'High Pot / Low Perf',
    desc: 'High potential but current performance is below benchmark. Needs targeted coaching.',
    perfRange: 'Low',
    potRange: 'High',
    color: '#06b6d4',
    bgLight: 'rgba(6, 182, 212, 0.1)',
    icon: AlertCircle,
  },
  {
    id: 'growth',
    row: 0,
    col: 1,
    title: 'Growth Talent',
    shortLabel: 'High Pot / Med Perf',
    desc: 'Solid performer with exceptional leadership potential. Ready for stretch assignments.',
    perfRange: 'Medium',
    potRange: 'High',
    color: '#4b5563',
    bgLight: 'rgba(17, 24, 39, 0.1)',
    icon: TrendingUp,
  },
  {
    id: 'star',
    row: 0,
    col: 2,
    title: 'Top Star Talent',
    shortLabel: 'High Pot / High Perf',
    desc: 'Highest tier performer and natural leader. Fast-track for executive succession.',
    perfRange: 'High',
    potRange: 'High',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    icon: Crown,
  },

  // Middle Row (Medium Potential)
  {
    id: 'dilemma',
    row: 1,
    col: 0,
    title: 'Dilemma / Inconsistent',
    shortLabel: 'Med Pot / Low Perf',
    desc: 'Average potential with low output. Requires structured performance improvement plan.',
    perfRange: 'Low',
    potRange: 'Medium',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.1)',
    icon: AlertCircle,
  },
  {
    id: 'core',
    row: 1,
    col: 1,
    title: 'Core Pillar Player',
    shortLabel: 'Med Pot / Med Perf',
    desc: 'Reliable contributor delivering consistent quality in daily hotel operations.',
    perfRange: 'Medium',
    potRange: 'Medium',
    color: '#111827',
    bgLight: 'rgba(17, 24, 39, 0.1)',
    icon: Users,
  },
  {
    id: 'high_performer',
    row: 1,
    col: 2,
    title: 'High Performer',
    shortLabel: 'Med Pot / High Perf',
    desc: 'Outstanding individual contributor with mastery in hospitality SOPs.',
    perfRange: 'High',
    potRange: 'Medium',
    color: '#3b82f6',
    bgLight: 'rgba(59, 130, 246, 0.1)',
    icon: Star,
  },

  // Bottom Row (Low Potential)
  {
    id: 'risk',
    row: 2,
    col: 0,
    title: 'Performance Risk',
    shortLabel: 'Low Pot / Low Perf',
    desc: 'Action required: Performance review, role realignment, or skill re-training.',
    perfRange: 'Low',
    potRange: 'Low',
    color: '#ef4444',
    bgLight: 'rgba(239, 68, 68, 0.1)',
    icon: ShieldAlert,
  },
  {
    id: 'effective',
    row: 2,
    col: 1,
    title: 'Effective Specialist',
    shortLabel: 'Low Pot / Med Perf',
    desc: 'Solid operational skill in current role with specialized functional focus.',
    perfRange: 'Medium',
    potRange: 'Low',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.1)',
    icon: CheckCircle2,
  },
  {
    id: 'trusted_pro',
    row: 2,
    col: 2,
    title: 'Trusted Professional',
    shortLabel: 'Low Pot / High Perf',
    desc: 'Master of current craft and veteran hospitality anchor with deep institutional knowledge.',
    perfRange: 'High',
    potRange: 'Low',
    color: '#111827',
    bgLight: 'rgba(81, 58, 179, 0.1)',
    icon: Zap,
  },
]

export default function InteractiveTalentGrid({ employees = [], onSelectEmployee }) {
  const [selectedBoxId, setSelectedBoxId] = useState(null)
  const [selectedDept, setSelectedDept] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set()
    employees.forEach((e) => {
      if (e.department) set.add(e.department)
    })
    return Array.from(set).sort()
  }, [employees])

  // Filter employees by department and search
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchDept = selectedDept === 'ALL' || e.department === selectedDept
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        (e.full_name || '').toLowerCase().includes(q) ||
        (e.job_title || '').toLowerCase().includes(q)
      return matchDept && matchSearch
    })
  }, [employees, selectedDept, searchQuery])

  // Map each employee into one of the 9 boxes based on (Performance, Competency/Potential)
  const categorizedData = useMemo(() => {
    const map = {}
    NINE_BOX_MATRIX.forEach((box) => {
      map[box.id] = []
    })

    filteredEmployees.forEach((emp) => {
      const perf = Number(emp.performance_score || 75)
      const comp = Number(emp.competency_score || 75)

      // Determine Performance tier (X-axis)
      let perfTier = 'Medium'
      if (perf >= 85) perfTier = 'High'
      else if (perf < 72) perfTier = 'Low'

      // Determine Potential tier (Y-axis) based on competency and readiness
      let potTier = 'Medium'
      if (comp >= 85 || emp.readiness === 'ready_now') potTier = 'High'
      else if (comp < 72 || emp.readiness === 'not_ready' || emp.readiness === 'development_needed') potTier = 'Low'

      const matchBox = NINE_BOX_MATRIX.find(
        (b) => b.perfRange === perfTier && b.potRange === potTier
      )
      if (matchBox) {
        map[matchBox.id].push(emp)
      } else {
        map.core.push(emp)
      }
    })

    return map
  }, [filteredEmployees])

  const activeBox = NINE_BOX_MATRIX.find((b) => b.id === selectedBoxId)
  const activeStaffList = selectedBoxId
    ? categorizedData[selectedBoxId] || []
    : filteredEmployees

  return (
    <div className="talent-grid-container">
      {/* ── TOOLBAR ──────────────────────────────────────────────────────────── */}
      <div className="talent-grid-toolbar">
        <div className="talent-grid-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="#111827" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#111827' }}>
              Filter:
            </span>
          </div>

          <select
            className="talent-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">All Departments ({employees.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="talent-search"
            placeholder="Search employee or role…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {selectedBoxId && (
            <button
              type="button"
              className="talent-clear-btn"
              onClick={() => setSelectedBoxId(null)}
            >
              <X size={12} />
              <span>Show All 9 Boxes</span>
            </button>
          )}
        </div>

        <div className="talent-summary-badge">
          <span>Total Pool: <b>{filteredEmployees.length}</b> staff</span>
        </div>
      </div>

      {/* ── 9-BOX INTERACTIVE CANVAS ────────────────────────────────────────── */}
      <div className="nine-box-wrapper">
        <div className="nine-box-y-label">
          <span>POTENTIAL & LEADERSHIP READINESS →</span>
        </div>

        <div className="nine-box-grid">
          {NINE_BOX_MATRIX.map((box) => {
            const list = categorizedData[box.id] || []
            const isSelected = selectedBoxId === box.id
            const BoxIcon = box.icon

            return (
              <div
                key={box.id}
                className={`nine-box-cell ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedBoxId(isSelected ? null : box.id)}
                style={{
                  borderTopColor: box.color,
                  backgroundColor: isSelected ? box.bgLight : undefined,
                }}
              >
                <div className="nine-box-cell-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BoxIcon size={14} color={box.color} />
                    <span className="nine-box-title" style={{ color: box.color }}>
                      {box.title}
                    </span>
                  </div>
                  <span
                    className="nine-box-count"
                    style={{ backgroundColor: box.color }}
                  >
                    {list.length}
                  </span>
                </div>

                <div className="nine-box-desc">{box.shortLabel}</div>

                <div className="nine-box-chips">
                  {list.slice(0, 3).map((emp) => (
                    <span
                      key={emp.id}
                      className="nine-box-emp-pill"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onSelectEmployee) onSelectEmployee(emp)
                      }}
                      title={`${emp.full_name} (${emp.job_title || emp.department})`}
                    >
                      {emp.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  ))}
                  {list.length > 3 && (
                    <span className="nine-box-more-pill">+{list.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="nine-box-x-label">
        <span>PERFORMANCE & OPERATIONAL DELIVERY →</span>
      </div>

      {/* ── DETAIL TALENT DRAWER / LIST ─────────────────────────────────────── */}
      <div className="talent-list-card">
        <div className="talent-list-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeBox ? (
              <>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: activeBox.color,
                  }}
                />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                  {activeBox.title} ({activeStaffList.length})
                </h4>
              </>
            ) : (
              <>
                <Users size={16} color="#111827" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                  All Categorized Staff ({activeStaffList.length})
                </h4>
              </>
            )}
          </div>
          {activeBox && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {activeBox.desc}
            </span>
          )}
        </div>

        {activeStaffList.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No employees found in this grid cell.
          </div>
        ) : (
          <div className="talent-staff-grid">
            {activeStaffList.map((emp) => (
              <div
                key={emp.id}
                className="talent-staff-item"
                onClick={() => onSelectEmployee && onSelectEmployee(emp)}
              >
                <div className="talent-staff-av">
                  {emp.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="talent-staff-info">
                  <b>{emp.full_name}</b>
                  <small>{emp.department} • {emp.job_title || 'Hospitality Staff'}</small>
                </div>
                <div className="talent-staff-scores">
                  <span className="talent-metric-chip" title="Performance Score">
                    Perf: <b>{emp.performance_score || 0}%</b>
                  </span>
                  <span className="talent-metric-chip" title="Competency Score">
                    Comp: <b>{emp.competency_score || 0}%</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
