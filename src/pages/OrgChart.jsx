import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import {
  Users,
  Crown,
  Sparkles,
  TrendingUp,
  Zap,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Maximize2,
  Sliders,
} from 'lucide-react'
import '../orgChart.css'
import PageBanner from '../components/PageBanner'

// Department top bar color classification
function getDeptBarClass(dept = '') {
  const d = dept.toLowerCase()
  if (d.includes('executive')) return 'bar-executive'
  if (d.includes('front')) return 'bar-frontoffice'
  if (d.includes('housekeeping')) return 'bar-housekeeping'
  if (d.includes('food') || d.includes('beverage')) return 'bar-foodbeverage'
  if (d.includes('kitchen')) return 'bar-kitchen'
  if (d.includes('operations')) return 'bar-operations'
  if (d.includes('human') || d.includes('hr')) return 'bar-hr'
  return 'bar-operations'
}

// Readiness pill badge helper (STRICTLY ICONS, NO EMOJIS)
function ReadinessBadge({ band }) {
  if (band === 'ready_now') {
    return (
      <span className="org-readiness-badge badge-ready-now" title="Succession: Ready Now">
        <CheckCircle2 size={11} />
        <span>Ready Now</span>
      </span>
    )
  }
  if (band === 'ready_in_1_2_years') {
    return (
      <span className="org-readiness-badge badge-ready-1yr" title="Succession: Ready in 1-2 Years">
        <Clock size={11} />
        <span>1-2 Years</span>
      </span>
    )
  }
  return (
    <span className="org-readiness-badge badge-dev-needed" title="Succession: Developing Talent">
      <Sparkles size={11} />
      <span>Developing</span>
    </span>
  )
}

// Recursive Tree Node Component
function TreeNode({ node, onSelect, selectedId, collapsedNodes, toggleCollapse, isFilterActive }) {
  const isSelected = selectedId === node.id
  const hasChildren = node.children && node.children.length > 0
  // When filter is active, automatically show all matching paths
  const isCollapsed = !isFilterActive && collapsedNodes.has(node.id)
  const isDimmed = isFilterActive && node.isDirectMatch === false

  const initials = node.fullName
    ? node.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'EM'

  return (
    <div className="org-node-group">
      <div
        className={`org-node-card ${isSelected ? 'selected-node' : ''} ${isDimmed ? 'dimmed-node' : ''}`}
        onClick={() => onSelect(node)}
      >
        <div className={`org-node-top-bar ${getDeptBarClass(node.department)}`} />

        <div className="org-node-header">
          {node.avatarUrl ? (
            <img
              src={node.avatarUrl}
              alt={node.fullName}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                objectFit: 'cover',
                display: 'block',
                flexShrink: 0,
              }}
            />
          ) : (
            <div className="org-node-avatar">{initials}</div>
          )}
          <div className="org-node-info">
            <div className="org-node-name">{node.fullName}</div>
            <div className="org-node-title">{node.jobTitle}</div>
          </div>
        </div>

        <div className="org-node-dept-tag">{node.department}</div>

        <div className="org-node-metrics">
          <div className="org-node-metric-item">
            <span>Perf</span>
            <span className="org-node-metric-val">{node.performanceScore}%</span>
          </div>
          <div className="org-node-metric-item">
            <span>Comp</span>
            <span className="org-node-metric-val">{node.competencyScore}%</span>
          </div>
        </div>

        <div className="org-node-readiness-row">
          <ReadinessBadge band={node.readinessBand} />
          {node.flightRisk === 'high' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                fontWeight: 700,
                color: '#ef4444',
              }}
              title="High Flight Risk"
            >
              <ShieldAlert size={11} />
              <span>Risk</span>
            </span>
          )}
        </div>

        {hasChildren && !isFilterActive && (
          <button
            type="button"
            className="org-node-toggle-btn"
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(node.id)
            }}
            title={isCollapsed ? `Expand ${node.children.length} direct reports` : 'Collapse direct reports'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className="org-children-container">
          {node.children.map((child) => (
            <div key={child.id} className="org-child-branch">
              <TreeNode
                node={child}
                onSelect={onSelect}
                selectedId={selectedId}
                collapsedNodes={collapsedNodes}
                toggleCollapse={toggleCollapse}
                isFilterActive={isFilterActive}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChart() {
  const [tree, setTree] = useState([])
  const [nodes, setNodes] = useState([])
  const [departments, setDepartments] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)

  // Filters & Zoom
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDept, setSelectedDept] = useState('ALL')
  const [selectedReadiness, setSelectedReadiness] = useState('ALL')
  const [zoomLevel, setZoomLevel] = useState(0.85)
  const [percentInput, setPercentInput] = useState('85')
  const [collapsedNodes, setCollapsedNodes] = useState(new Set())
  const [isPanning, setIsPanning] = useState(false)
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const canvasRef = useRef(null)
  const treeContainerRef = useRef(null)

  // Keep input text synced with current zoom
  useEffect(() => {
    setPercentInput(String(Math.round(zoomLevel * 100)))
  }, [zoomLevel])

  // Custom Zoom Helper - Clamped between 15% (0.15) and 300% (3.00)
  const setZoomTo = (rawPct) => {
    const num = Number(rawPct)
    if (!Number.isFinite(num)) return
    const clamped = Math.max(0.15, Math.min(3.0, num / 100))
    setZoomLevel(Math.round(clamped * 100) / 100)
  }

  const handlePercentInputBlur = () => {
    const clean = percentInput.replace(/[^0-9.]/g, '')
    if (clean) {
      setZoomTo(clean)
    } else {
      setPercentInput(String(Math.round(zoomLevel * 100)))
    }
  }

  const handlePercentInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  const fitToScreen = () => {
    if (!canvasRef.current || !treeContainerRef.current) {
      setZoomLevel(0.65)
      return
    }
    const canvasWidth = canvasRef.current.clientWidth - 80
    const treeWidth = treeContainerRef.current.scrollWidth || 1400
    if (treeWidth > 0) {
      const calculated = Math.max(0.2, Math.min(1.2, canvasWidth / treeWidth))
      setZoomLevel(Math.round(calculated * 100) / 100)
    }
  }

  // Ctrl + Wheel Zoom & Trackpad Pinch Zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 0.05 : -0.05
        setZoomLevel(prev => {
          const next = Math.max(0.15, Math.min(3.0, Math.round((prev + delta) * 100) / 100))
          return next
        })
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  // Drag-to-pan Canvas Navigation
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest('.org-node-card') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
    setIsPanning(true)
    if (canvasRef.current) {
      setPanOrigin({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: canvasRef.current.scrollLeft,
        scrollTop: canvasRef.current.scrollTop
      })
    }
  }

  const handleCanvasMouseMove = (e) => {
    if (!isPanning || !canvasRef.current) return
    const dx = e.clientX - panOrigin.x
    const dy = e.clientY - panOrigin.y
    canvasRef.current.scrollLeft = panOrigin.scrollLeft - dx
    canvasRef.current.scrollTop = panOrigin.scrollTop - dy
  }

  const handleCanvasMouseUp = () => {
    setIsPanning(false)
  }

  // Fetch Tree on mount + auto-refresh every 30 s so succession approvals are reflected live
  const loadTree = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.orgTree()
      setTree(res.tree || [])
      setNodes(res.nodes || [])
      setDepartments(res.departments || [])
      setSummary(res.summary || null)
    } catch {
      // Handle error gracefully
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    loadTree()
    // Silent background refresh every 30 s — picks up succession position updates
    const interval = setInterval(() => { if (alive) loadTree(true) }, 30000)
    return () => { alive = false; clearInterval(interval) }
  }, [])

  const toggleCollapse = (nodeId) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const expandAll = () => setCollapsedNodes(new Set())
  const collapseAll = () => {
    const allManagerIds = new Set(nodes.filter(n => n.directReportsCount > 0).map(n => n.id))
    setCollapsedNodes(allManagerIds)
  }

  const isFilterActive = Boolean(searchTerm.trim() || selectedDept !== 'ALL' || selectedReadiness !== 'ALL')

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedDept('ALL')
    setSelectedReadiness('ALL')
  }

  // Recursive pruning of non-matching branches
  const filteredTree = useMemo(() => {
    if (!isFilterActive) {
      return tree
    }

    const term = searchTerm.trim().toLowerCase()

    function checkAndFilterNode(node) {
      const matchSearch = !term ||
        node.fullName?.toLowerCase().includes(term) ||
        node.jobTitle?.toLowerCase().includes(term) ||
        node.department?.toLowerCase().includes(term)

      const matchDept = selectedDept === 'ALL' || node.department === selectedDept
      const matchReadiness = selectedReadiness === 'ALL' || node.readinessBand === selectedReadiness

      const isDirectMatch = matchSearch && matchDept && matchReadiness

      const filteredChildren = (node.children || [])
        .map(checkAndFilterNode)
        .filter(Boolean)

      if (isDirectMatch || filteredChildren.length > 0) {
        return {
          ...node,
          isDirectMatch,
          children: filteredChildren,
        }
      }
      return null
    }

    return tree.map(checkAndFilterNode).filter(Boolean)
  }, [tree, isFilterActive, searchTerm, selectedDept, selectedReadiness])

  // Flat matching employees count
  const matchingEmployeesCount = useMemo(() => {
    if (!isFilterActive) return nodes.length
    const term = searchTerm.trim().toLowerCase()
    return nodes.filter(n => {
      const matchSearch = !term ||
        n.fullName?.toLowerCase().includes(term) ||
        n.jobTitle?.toLowerCase().includes(term) ||
        n.department?.toLowerCase().includes(term)
      const matchDept = selectedDept === 'ALL' || n.department === selectedDept
      const matchReadiness = selectedReadiness === 'ALL' || n.readinessBand === selectedReadiness
      return matchSearch && matchDept && matchReadiness
    }).length
  }, [nodes, isFilterActive, searchTerm, selectedDept, selectedReadiness])

  return (
    <div className="org-chart-page-container">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <PageBanner
        title="Organizational Hierarchy"
        description="Visual reporting tree connecting organizational hierarchy, succession readiness, and skill competencies."
        icon={<Layers className="w-5 h-5 text-white" />}
        actions={
          <>
            <button
              type="button"
              className="saas-btn-secondary"
              onClick={() => loadTree(false)}
              title="Refresh org chart — picks up any new succession promotions"
            >
              <RotateCcw size={14} color="#111827" />
              <span>Refresh Chart</span>
            </button>
            <Link to="/succession" className="saas-btn-secondary" style={{ textDecoration: 'none' }}>
              <Crown size={14} color="#111827" />
              <span>Succession Planning</span>
            </Link>
            <Link to="/competency" className="saas-btn-secondary" style={{ textDecoration: 'none' }}>
              <Zap size={14} color="#111827" />
              <span>Skill Radar</span>
            </Link>
          </>
        }
      />

      {/* ── KPI CARDS ───────────────────────────────────────────────────────── */}
      <div className="org-chart-kpis">
        <div className="org-kpi-card">
          <div className="org-kpi-icon-wrap icon-wrap-violet">
            <Users size={20} />
          </div>
          <div>
            <div className="org-kpi-value">{summary?.totalEmployees || nodes.length || 0}</div>
            <div className="org-kpi-label">Active Hotel Staff</div>
          </div>
        </div>

        <div className="org-kpi-card">
          <div className="org-kpi-icon-wrap icon-wrap-emerald">
            <Crown size={20} />
          </div>
          <div>
            <div className="org-kpi-value">{summary?.readyNowCount || 0}</div>
            <div className="org-kpi-label">Succession Ready Now</div>
          </div>
        </div>

        <div className="org-kpi-card">
          <div className="org-kpi-icon-wrap icon-wrap-amber">
            <Clock size={20} />
          </div>
          <div>
            <div className="org-kpi-value">{summary?.ready1to2YearsCount || 0}</div>
            <div className="org-kpi-label">Ready in 1-2 Years</div>
          </div>
        </div>

        <div className="org-kpi-card">
          <div className="org-kpi-icon-wrap icon-wrap-rose">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="org-kpi-value">{summary?.highFlightRiskCount || 0}</div>
            <div className="org-kpi-label">High Retention Risk</div>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR & CONTROLS ──────────────────────────────────────────────── */}
      <div className="org-chart-toolbar">
        <div className="org-toolbar-left">
          <div className="org-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search staff, role, department…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="org-select-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>{d.name} ({d.headcount})</option>
            ))}
          </select>

          <select
            className="org-select-filter"
            value={selectedReadiness}
            onChange={(e) => setSelectedReadiness(e.target.value)}
          >
            <option value="ALL">All Readiness Levels</option>
            <option value="ready_now">Ready Now</option>
            <option value="ready_in_1_2_years">Ready in 1-2 Years</option>
            <option value="development_needed">Development Needed</option>
          </select>
        </div>

        <div className="org-toolbar-right">
          <button type="button" className="org-btn-tool" onClick={expandAll} title="Expand all branches">
            <Layers size={14} />
            <span>Expand All</span>
          </button>

          <button type="button" className="org-btn-tool" onClick={collapseAll} title="Collapse all branches">
            <ChevronUp size={14} />
            <span>Collapse</span>
          </button>

          {/* Full Arbitrary Zoom Control Suite */}
          <div className="org-zoom-suite">
            {/* Zoom Out Button */}
            <button
              type="button"
              className="org-btn-tool"
              style={{ padding: '6px 8px', border: 'none', background: 'transparent' }}
              onClick={() => setZoomLevel(prev => Math.max(0.15, Math.round((prev - 0.05) * 100) / 100))}
              title="Zoom Out (Ctrl + Scroll Down)"
            >
              <ZoomOut size={15} />
            </button>

            {/* Smooth Zoom Slider from 15% to 250% */}
            <input
              type="range"
              className="org-zoom-slider"
              min="15"
              max="250"
              step="1"
              value={Math.round(zoomLevel * 100)}
              onChange={(e) => setZoomTo(e.target.value)}
              title={`Zoom Slider: ${Math.round(zoomLevel * 100)}%`}
            />

            {/* Direct Editable Percentage Input */}
            <div className="org-zoom-input-wrap" title="Type any custom percentage and press Enter">
              <input
                type="text"
                className="org-zoom-input-field"
                value={percentInput}
                onChange={(e) => setPercentInput(e.target.value)}
                onBlur={handlePercentInputBlur}
                onKeyDown={handlePercentInputKeyDown}
              />
              <span className="org-zoom-input-unit">%</span>
            </div>

            {/* Preset Percentage Quick Picker */}
            <select
              className="org-zoom-select-presets"
              value={['25', '40', '50', '60', '75', '85', '100', '125', '150', '200', '250'].includes(String(Math.round(zoomLevel * 100))) ? String(Math.round(zoomLevel * 100)) : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'fit') fitToScreen()
                else if (e.target.value !== 'custom') setZoomTo(e.target.value)
              }}
              title="Select zoom preset or fit to screen"
            >
              <option value="custom" disabled hidden>Zoom</option>
              <option value="fit">Fit to Screen</option>
              <option value="25">25% (Full Overview)</option>
              <option value="40">40%</option>
              <option value="50">50%</option>
              <option value="60">60%</option>
              <option value="75">75%</option>
              <option value="85">85% (Comfortable)</option>
              <option value="100">100% (Standard)</option>
              <option value="125">125%</option>
              <option value="150">150% (Close-Up)</option>
              <option value="200">200% (Large Focus)</option>
              <option value="250">250% (Max)</option>
            </select>

            {/* Zoom In Button */}
            <button
              type="button"
              className="org-btn-tool"
              style={{ padding: '6px 8px', border: 'none', background: 'transparent' }}
              onClick={() => setZoomLevel(prev => Math.min(3.0, Math.round((prev + 0.05) * 100) / 100))}
              title="Zoom In (Ctrl + Scroll Up)"
            >
              <ZoomIn size={15} />
            </button>

            {/* Fit to Screen Button */}
            <button
              type="button"
              className="org-btn-tool"
              style={{ padding: '6px 10px', fontSize: 11.5 }}
              onClick={fitToScreen}
              title="Auto-Fit Entire Tree to Screen Width"
            >
              <Maximize2 size={13} />
              <span>Fit</span>
            </button>

            {/* Reset to 100% */}
            <button
              type="button"
              className="org-btn-tool"
              style={{ padding: '6px 10px', fontSize: 11.5 }}
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom to 100%"
            >
              <RotateCcw size={12} />
              <span>100%</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ACTIVE FILTER BAR ────────────────────────────────────────────── */}
      {isFilterActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderRadius: 14,
            background: 'rgba(81, 58, 179, 0.08)',
            border: '1px solid rgba(81, 58, 179, 0.25)',
            fontSize: 13,
            fontWeight: 700,
            color: '#111827',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>
              Filtered: <b>{matchingEmployeesCount}</b> employee{matchingEmployeesCount !== 1 ? 's' : ''} match selected criteria
              {selectedReadiness !== 'ALL' && ` • Readiness: ${selectedReadiness.replace(/_/g, ' ')}`}
              {selectedDept !== 'ALL' && ` • Dept: ${selectedDept}`}
              {searchTerm && ` • Query: "${searchTerm}"`}
            </span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="org-btn-tool"
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            <X size={12} />
            <span>Clear Filters</span>
          </button>
        </div>
      )}

      {/* ── INTERACTIVE TREE CANVAS ─────────────────────────────────────────── */}
      <div 
        ref={canvasRef}
        className={`org-chart-canvas-wrapper ${isPanning ? 'is-panning' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Floating Glassmorphic Quick Zoom Indicator in Corner */}
        <div className="org-floating-zoom-badge">
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            className="org-btn-tool"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setZoomLevel(prev => Math.max(0.15, Math.round((prev - 0.1) * 100) / 100))}
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            className="org-btn-tool"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setZoomLevel(prev => Math.min(3.0, Math.round((prev + 0.1) * 100) / 100))}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="org-btn-tool"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={fitToScreen}
            title="Fit to Screen"
          >
            <Maximize2 size={11} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
            <div className="skeleton-bar" style={{ width: 140, height: 14, borderRadius: 8 }} />
            <div style={{ fontSize: 13, color: '#64748b' }}>Loading Hotel Organizational Hierarchy…</div>
          </div>
        ) : filteredTree.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 8, color: '#64748b' }}>
            <Building2 size={36} color="#94a3b8" />
            <div style={{ fontSize: 15, fontWeight: 700 }}>No employee matches found</div>
            <div style={{ fontSize: 12.5 }}>Try adjusting your search query or department filter.</div>
            <button
              type="button"
              onClick={resetFilters}
              className="org-btn-tool"
              style={{ marginTop: 10 }}
            >
              <RotateCcw size={13} />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          <div
            ref={treeContainerRef}
            className="org-tree-root-container"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: isPanning ? 'none' : 'transform 0.15s ease' }}
          >
            {filteredTree.map((rootNode) => (
              <TreeNode
                key={rootNode.id}
                node={rootNode}
                onSelect={(n) => setSelectedNode(n)}
                selectedId={selectedNode?.id}
                collapsedNodes={collapsedNodes}
                toggleCollapse={toggleCollapse}
                isFilterActive={isFilterActive}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── SUCCESSION & COMPETENCY SIDE INSPECTION DRAWER ──────────────────── */}
      {selectedNode && (
        <div className="org-drawer-backdrop" onClick={() => setSelectedNode(null)}>
          <div className="org-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="org-drawer-header">
              <div className="org-drawer-title-row">
                <Building2 size={18} color="#111827" />
                <h2>Profile & Succession Insight</h2>
              </div>
              <button
                type="button"
                className="org-drawer-close-btn"
                onClick={() => setSelectedNode(null)}
                aria-label="Close Drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="org-drawer-body">
              {/* Profile Hero */}
              <div className="org-profile-hero">
                {selectedNode.avatarUrl ? (
                  <img
                    src={selectedNode.avatarUrl}
                    alt={selectedNode.fullName}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      objectFit: 'cover',
                      display: 'block',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div className="org-hero-avatar">
                    {selectedNode.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="org-hero-name">{selectedNode.fullName}</div>
                  <div className="org-hero-title">{selectedNode.jobTitle} • {selectedNode.department}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <ReadinessBadge band={selectedNode.readinessBand} />
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>
                      ID: {selectedNode.employeeNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance & Competency Summary */}
              <div className="org-drawer-section">
                <div className="org-section-heading">
                  <TrendingUp size={14} color="#111827" />
                  <span>Evaluation & Scores</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '12px 10px', background: '#f8fafc', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Performance</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{selectedNode.performanceScore}%</div>
                  </div>
                  <div style={{ padding: '12px 10px', background: '#f8fafc', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Competency</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{selectedNode.competencyScore}%</div>
                  </div>
                  <div style={{ padding: '12px 10px', background: '#f8fafc', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Learning</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{selectedNode.learningProgress}%</div>
                  </div>
                </div>
              </div>

              {/* Succession Pipeline Detail */}
              <div className="org-drawer-section">
                <div className="org-section-heading">
                  <Crown size={14} color="#111827" />
                  <span>Succession Pipeline Analysis</span>
                </div>
                <div className="org-succession-card">
                  <div className="org-succ-row">
                    <span className="org-succ-label">Target Role</span>
                    <span className="org-succ-val">{selectedNode.targetRole}</span>
                  </div>
                  <div className="org-succ-row">
                    <span className="org-succ-label">Succession Readiness</span>
                    <span className="org-succ-val">{selectedNode.readinessScore}% ({selectedNode.readinessBand.replace(/_/g, ' ')})</span>
                  </div>
                  <div className="org-succ-row">
                    <span className="org-succ-label">Retention / Flight Risk</span>
                    <span
                      className="org-succ-val"
                      style={{ color: selectedNode.flightRisk === 'high' ? '#ef4444' : selectedNode.flightRisk === 'medium' ? '#f59e0b' : '#10b981' }}
                    >
                      {selectedNode.flightRisk.toUpperCase()}
                    </span>
                  </div>
                  <div className="org-succ-row">
                    <span className="org-succ-label">Reporting Manager</span>
                    <span className="org-succ-val">{selectedNode.managerName || 'Executive Board'}</span>
                  </div>
                </div>
              </div>

              {/* Competency Breakdown Skills */}
              <div className="org-drawer-section">
                <div className="org-section-heading">
                  <Zap size={14} color="#111827" />
                  <span>Key Competency Alignment</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedNode.competencies?.map((comp) => (
                    <div key={comp.name} className="org-comp-bar-item">
                      <div className="org-comp-bar-labels">
                        <span>{comp.name}</span>
                        <span>{comp.score}%</span>
                      </div>
                      <div className="org-comp-track">
                        <div className="org-comp-fill" style={{ width: `${comp.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Reports */}
              {selectedNode.children && selectedNode.children.length > 0 && (
                <div className="org-drawer-section">
                  <div className="org-section-heading">
                    <Users size={14} color="#111827" />
                    <span>Direct Team Members ({selectedNode.children.length})</span>
                  </div>
                  <div className="org-reports-list">
                    {selectedNode.children.map((child) => (
                      <div
                        key={child.id}
                        className="org-report-mini-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedNode(child)}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{child.fullName}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{child.jobTitle}</div>
                        </div>
                        <ReadinessBadge band={child.readinessBand} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="org-drawer-footer">
              <Link to="/succession" className="org-drawer-action-btn">
                <Crown size={14} />
                <span>Nominate Candidate</span>
              </Link>
              <Link to="/competency" className="org-drawer-secondary-btn">
                <BookOpen size={14} />
                <span>Development Plan</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
