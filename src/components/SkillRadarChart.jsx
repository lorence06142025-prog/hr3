import React, { useState, useMemo } from 'react'
import { Sparkles, CheckCircle, AlertTriangle, Target, Info } from 'lucide-react'

export const LEVEL_SCORES = {
  Foundation: 60,
  Developing: 75,
  Proficient: 88,
  Expert: 98,
}

export const LEVEL_COLORS = {
  Foundation: '#94a3b8',
  Developing: '#f59e0b',
  Proficient: '#111827',
  Expert: '#10b981',
}

export default function SkillRadarChart({
  competencies = [],
  roleName = 'Role Standard',
  employeeName = 'Employee',
  actualScores = {},
  onSelectCompetency,
  selectedCompetency,
  size = 340,
  showTable = true,
  compact = false,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  // Normalize competencies data with fallback defaults
  const data = useMemo(() => {
    if (!competencies || competencies.length === 0) return []
    return competencies.map((item, idx) => {
      const name = item.competency || item.name || `Skill ${idx + 1}`
      const level = item.level || 'Proficient'
      const target = item.target || item.targetScore || LEVEL_SCORES[level] || 85
      const actual = actualScores[name] !== undefined
        ? Number(actualScores[name])
        : item.actual !== undefined
          ? Number(item.actual)
          : item.score !== undefined
            ? Number(item.score)
            : Math.max(40, Math.min(100, Math.round(target * 0.85)))
      const weight = Number(item.weight || 0)
      const category = item.category || 'Competency'
      const gap = Math.round(actual - target)

      return {
        id: idx,
        name,
        level,
        target: Math.min(100, Math.max(0, target)),
        actual: Math.min(100, Math.max(0, actual)),
        weight,
        category,
        gap,
        isMet: actual >= target,
      }
    })
  }, [competencies, actualScores])

  const count = data.length

  // Overall calculations
  const summary = useMemo(() => {
    if (data.length === 0) return { matchPct: 0, metCount: 0, gapCount: 0, topStrength: '—', topGap: '—' }
    const totalTarget = data.reduce((sum, d) => sum + d.target, 0)
    const totalActual = data.reduce((sum, d) => sum + d.actual, 0)
    const matchPct = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0
    const metCount = data.filter(d => d.isMet).length
    const gapCount = data.length - metCount

    // Sort to find top strength and primary gap
    const sortedByDelta = [...data].sort((a, b) => b.gap - a.gap)
    const topStrength = sortedByDelta[0]
    const topGap = sortedByDelta[sortedByDelta.length - 1]

    return {
      matchPct,
      metCount,
      gapCount,
      topStrength: topStrength && topStrength.gap >= 0 ? topStrength.name : (data[0]?.name || '—'),
      topGap: topGap && topGap.gap < 0 ? topGap.name : 'All Met',
    }
  }, [data])

  // Radar geometry calculations
  const center = size / 2
  const radius = (size / 2) - 62   // shrink polygon so labels have more breathing room
  const levels = [20, 40, 60, 80, 100]

  // Word-wrap a label into up to two lines at a max character width
  const wrapLabel = (name, maxChars = 16) => {
    if (name.length <= maxChars) return [name]
    // Try to break at the last space before maxChars
    const idx = name.lastIndexOf(' ', maxChars)
    if (idx > 0) return [name.slice(0, idx), name.slice(idx + 1)]
    // Hard-break if no space found
    return [name.slice(0, maxChars), name.slice(maxChars)]
  }

  // Convert polar coordinates to Cartesian (x, y)
  const getCoordinates = (value, index) => {
    if (count === 0) return { x: center, y: center }
    const angle = (Math.PI * 2 / count) * index - (Math.PI / 2)
    const r = (value / 100) * radius
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return { x, y, angle }
  }

  // Generate polygon points string from data
  const targetPoints = useMemo(() => {
    if (count < 3) return ''
    return data.map((d, i) => {
      const { x, y } = getCoordinates(d.target, i)
      return `${x},${y}`
    }).join(' ')
  }, [data, count, radius])

  const actualPoints = useMemo(() => {
    if (count < 3) return ''
    return data.map((d, i) => {
      const { x, y } = getCoordinates(d.actual, i)
      return `${x},${y}`
    }).join(' ')
  }, [data, count, radius])

  if (count === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13, background: 'rgba(17, 24, 39, 0.04)', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
        <Target size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
        <b>No Competency Benchmarks Selected</b>
        <p style={{ margin: '4px 0 0', fontSize: 12 }}>Select a position benchmark template to generate the skill spider web radar chart.</p>
      </div>
    )
  }

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : (selectedCompetency ? data.find(d => d.name === selectedCompetency) : (data[0] || null))

  return (
    <div className="skill-radar-container" style={{
      background: 'var(--radar-bg, rgba(255, 255, 255, 0.04))',
      border: '1px solid var(--radar-border, rgba(148, 163, 184, 0.2))',
      borderRadius: 14,
      padding: compact ? 12 : 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      color: 'inherit',
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} style={{ color: '#4b5563' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              Skill Spider Web · {roleName}
            </h4>
          </div>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            Role Benchmark (Target) vs. {employeeName}'s Current Profile (Actual)
          </small>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: '#111827', display: 'inline-block' }} />
            <span style={{ color: '#111827' }}>Target Benchmark</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
            <span style={{ color: '#10b981' }}>Employee Actual</span>
          </div>
        </div>
      </div>

      {/* Main Visual: Spider Web + Metrics Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(260px, 1fr) minmax(200px, 0.9fr)', gap: 16, alignItems: 'center' }}>
        
        {/* SVG Radar Chart */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <svg
            viewBox={`-80 -80 ${size + 160} ${size + 160}`}
            style={{ width: '100%', maxWidth: size + 160, height: 'auto', overflow: 'visible', userSelect: 'none' }}
          >
            <defs>
              <radialGradient id="radarTargetGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#111827" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#4b5563" stopOpacity="0.08" />
              </radialGradient>
              <radialGradient id="radarActualGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
              </radialGradient>
            </defs>

            {/* Concentric Reference Rings */}
            {levels.map((lvl) => {
              const r = (lvl / 100) * radius
              if (count < 3) {
                return (
                  <circle
                    key={lvl}
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeDasharray="3 3"
                  />
                )
              }
              const ringPoints = data.map((_, i) => {
                const { x, y } = getCoordinates(lvl, i)
                return `${x},${y}`
              }).join(' ')

              return (
                <polygon
                  key={lvl}
                  points={ringPoints}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.22)"
                  strokeWidth="1"
                  strokeDasharray={lvl === 100 ? 'none' : '3 3'}
                />
              )
            })}

            {/* Ring Scale Labels */}
            {levels.map((lvl) => (
              <text
                key={`lvl-text-${lvl}`}
                x={center + 3}
                y={center - ((lvl / 100) * radius) - 2}
                fontSize="8"
                fill="#94a3b8"
                fontWeight="600"
              >
                {lvl}%
              </text>
            ))}

            {/* Radial Axis Rays from center to perimeter */}
            {data.map((d, i) => {
              const { x, y } = getCoordinates(100, i)
              const isHovered = hoveredIdx === i

              return (
                <line
                  key={`ray-${i}`}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke={isHovered ? '#4b5563' : 'rgba(148, 163, 184, 0.3)'}
                  strokeWidth={isHovered ? 1.5 : 1}
                />
              )
            })}

            {/* 1. Target Benchmark Polygon (Indigo/Violet) */}
            {count >= 3 && (
              <polygon
                points={targetPoints}
                fill="url(#radarTargetGlow)"
                stroke="#111827"
                strokeWidth="2"
                strokeDasharray="4 3"
                style={{ transition: 'all 0.3s ease' }}
              />
            )}

            {/* 2. Employee Actual Profile Polygon (Emerald/Teal) */}
            {count >= 3 && (
              <polygon
                points={actualPoints}
                fill="url(#radarActualGlow)"
                stroke="#10b981"
                strokeWidth="2.2"
                style={{ transition: 'all 0.3s ease' }}
              />
            )}

            {/* Target Vertex Dots */}
            {data.map((d, i) => {
              const { x, y } = getCoordinates(d.target, i)
              return (
                <circle
                  key={`target-dot-${i}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#111827"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}

            {/* Actual Vertex Dots & Interactive Hotspots */}
            {data.map((d, i) => {
              const { x, y } = getCoordinates(d.actual, i)
              const isHovered = hoveredIdx === i
              const isSelected = selectedCompetency === d.name

              return (
                <g key={`actual-group-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered || isSelected ? 6 : 4}
                    fill={d.isMet ? '#10b981' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      filter: isHovered ? 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))' : 'none',
                    }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectCompetency && onSelectCompetency(d.name)}
                  />
                </g>
              )
            })}

            {/* Outer Labels on Axis Ends */}
            {data.map((d, i) => {
              const labelDistance = radius + 44
              const angle = (Math.PI * 2 / count) * i - (Math.PI / 2)
              const lx = center + labelDistance * Math.cos(angle)
              const ly = center + labelDistance * Math.sin(angle)
              const isHovered = hoveredIdx === i
              const isSelected = selectedCompetency === d.name

              const textAnchor = Math.abs(Math.cos(angle)) < 0.25
                ? 'middle'
                : Math.cos(angle) > 0
                  ? 'start'
                  : 'end'

              const lines = wrapLabel(d.name, 15)
              const lineHeight = 11
              // Vertically centre the wrapped block around ly
              const totalTextH = lines.length * lineHeight
              const firstLineY = ly - (totalTextH / 2) + lineHeight / 2
              const scoreY = firstLineY + totalTextH + 4

              return (
                <g
                  key={`label-${i}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectCompetency && onSelectCompetency(d.name)}
                >
                  <text
                    x={lx}
                    y={firstLineY}
                    fontSize={isHovered || isSelected ? '10' : '9'}
                    fontWeight={isHovered || isSelected ? '800' : '700'}
                    fill={isHovered || isSelected ? '#4b5563' : 'currentColor'}
                    textAnchor={textAnchor}
                    dominantBaseline="auto"
                  >
                    {lines.map((line, li) => (
                      <tspan key={li} x={lx} dy={li === 0 ? 0 : lineHeight}>{line}</tspan>
                    ))}
                  </text>
                  <text
                    x={lx}
                    y={scoreY}
                    fontSize="8"
                    fill={d.isMet ? '#10b981' : '#f59e0b'}
                    fontWeight="700"
                    textAnchor={textAnchor}
                  >
                    {d.actual}% / {d.target}%
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Real-Time Assessment Scorecard & Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Key KPI Badge Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              background: 'rgba(17,24,39,0.08)',
              border: '1px solid rgba(17,24,39,0.2)',
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              <small style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#4b5563' }}>
                Benchmark Match
              </small>
              <div style={{ fontSize: 17, fontWeight: 800, color: summary.matchPct >= 90 ? '#10b981' : summary.matchPct >= 75 ? '#f59e0b' : '#ef4444' }}>
                {summary.matchPct}%
              </div>
              <small style={{ fontSize: 9.5, color: '#64748b' }}>
                {summary.metCount} of {data.length} skills met
              </small>
            </div>

            <div style={{
              background: summary.gapCount === 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${summary.gapCount === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              <small style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: summary.gapCount === 0 ? '#10b981' : '#f59e0b' }}>
                {summary.gapCount === 0 ? 'All Standards Met' : 'Skill Gaps'}
              </small>
              <div style={{ fontSize: 17, fontWeight: 800, color: summary.gapCount === 0 ? '#10b981' : '#f59e0b' }}>
                {summary.gapCount} {summary.gapCount === 1 ? 'Area' : 'Areas'}
              </div>
              <small style={{ fontSize: 9.5, color: '#64748b' }}>
                Gap: <b>{summary.topGap}</b>
              </small>
            </div>
          </div>

          {/* Active Highlighted Competency Card */}
          {activeItem ? (
            <div style={{
              background: activeItem.isMet ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
              border: `1px solid ${activeItem.isMet ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: LEVEL_COLORS[activeItem.level] || '#111827', color: '#fff' }}>
                  Required: {activeItem.level} ({activeItem.target}%)
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: activeItem.isMet ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {activeItem.isMet ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                  {activeItem.gap >= 0 ? `+${activeItem.gap}% Met` : `${activeItem.gap}% Gap`}
                </span>
              </div>
              <b style={{ fontSize: 12.5, display: 'block', color: 'inherit' }}>{activeItem.name}</b>
              <small style={{ fontSize: 10.5, color: '#64748b', display: 'block', margin: '2px 0 6px' }}>
                Category: {activeItem.category} · Weight: {activeItem.weight}%
              </small>

              {/* Progress Bar Comparison */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#64748b' }}>
                  <span>Actual: <b>{activeItem.actual}%</b></span>
                  <span>Benchmark: <b>{activeItem.target}%</b></span>
                </div>
                <div style={{ height: 5, width: '100%', background: 'rgba(148, 163, 184, 0.2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: `${activeItem.target}%`, top: 0, bottom: 0, width: 2, background: '#111827', zIndex: 2 }} />
                  <div style={{ height: '100%', width: `${activeItem.actual}%`, background: activeItem.isMet ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(148, 163, 184, 0.08)', border: '1px dashed rgba(148, 163, 184, 0.3)', fontSize: 10.5, color: '#64748b' }}>
              <Info size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              Hover over or click any radar point on the spider web to view detailed benchmark metrics.
            </div>
          )}
        </div>
      </div>

      {/* Detailed Table Breakdown */}
      {showTable && (
        <div style={{ marginTop: 4 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.25)', color: '#64748b', fontSize: 9.5, textTransform: 'uppercase' }}>
                  <th style={{ padding: '5px 6px' }}>Competency Dimension</th>
                  <th style={{ padding: '5px 6px' }}>Category</th>
                  <th style={{ padding: '5px 6px' }}>Level</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center' }}>Target</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center' }}>Actual</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => {
                  const isHovered = hoveredIdx === i
                  const isSelected = selectedCompetency === d.name
                  return (
                    <tr
                      key={d.name}
                      style={{
                        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                        background: isHovered || isSelected ? 'rgba(17,24,39,0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onClick={() => onSelectCompetency && onSelectCompetency(d.name)}
                    >
                      <td style={{ padding: '6px 6px', fontWeight: 650 }}>
                        {d.name}
                      </td>
                      <td style={{ padding: '6px 6px', color: '#64748b', fontSize: 10.5 }}>
                        {d.category}
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: `${LEVEL_COLORS[d.level]}20`,
                          color: LEVEL_COLORS[d.level] || '#111827',
                          border: `1px solid ${LEVEL_COLORS[d.level]}40`,
                        }}>
                          {d.level}
                        </span>
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: '#4b5563' }}>
                        {d.target}%
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: d.isMet ? '#10b981' : '#f59e0b' }}>
                        {d.actual}%
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: d.isMet ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: d.isMet ? '#10b981' : '#f59e0b',
                        }}>
                          {d.isMet ? '✓ Met' : `${d.gap}% Gap`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
