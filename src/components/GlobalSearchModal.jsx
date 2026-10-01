import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import {
  LayoutDashboard, BarChart3, Target, GraduationCap, Calendar, Crown, Trophy, Users,
  ScrollText, ClipboardList, Zap, Plus, Bot, Mail, User, Search, Loader2, X as XIcon,
  Sparkles
} from 'lucide-react'

const SYSTEM_PAGES = [
  { id: 'page-dashboard', type: 'page', title: 'AI Analytics Dashboard', subtitle: 'Overview, workforce KPIs, charts & reports', path: '/', IconComponent: LayoutDashboard, category: 'Pages' },
  { id: 'page-performance', type: 'page', title: 'Performance Reviews', subtitle: 'Self assessments, supervisor ratings & HR calibration', path: '/performance', IconComponent: BarChart3, category: 'Pages' },
  { id: 'page-competency', type: 'page', title: 'Skill Development & Competency', subtitle: 'Skill assessments, gap analysis & development plans', path: '/competency', IconComponent: Target, category: 'Pages' },
  { id: 'page-learning', type: 'page', title: 'Learning Progress & Courses', subtitle: 'Curated courses, study tracking & verified completions', path: '/learning', IconComponent: GraduationCap, category: 'Pages' },
  { id: 'page-training', type: 'page', title: 'Training Management & Calendar', subtitle: 'Session scheduling, QR attendance & evaluations', path: '/training', IconComponent: Calendar, category: 'Pages' },
  { id: 'page-succession', type: 'page', title: 'Succession Planning', subtitle: 'Talent pools, readiness matrices & bench strength', path: '/succession', IconComponent: Crown, category: 'Pages' },
  { id: 'page-recognition', type: 'page', title: 'Social Recognition', subtitle: 'Peer badges, nominations & team leaderboard', path: '/recognition', IconComponent: Trophy, category: 'Pages' },
  { id: 'page-employees', type: 'page', title: 'Employee Records & Directory', subtitle: 'Staff profiles, organizational roles & access', path: '/employees', IconComponent: Users, category: 'Pages' },
  { id: 'page-certificates', type: 'page', title: 'Certificate Management', subtitle: 'Award generation, templates & QR verification', path: '/certificates', IconComponent: ScrollText, category: 'Pages' },
  { id: 'page-audit', type: 'page', title: 'Audit & System Health', subtitle: 'Security logs, user actions & live service health status', path: '/audit', IconComponent: ClipboardList, category: 'Pages' },
]

const QUICK_ACTIONS = [
  { id: 'act-review', type: 'action', title: 'Launch Review Cycle', subtitle: 'Bulk start performance reviews across departments', path: '/performance', actionKey: 'bulk_review', IconComponent: Zap, category: 'Quick Actions' },
  { id: 'act-course', type: 'action', title: 'Add New Course', subtitle: 'Add a new training or learning resource to library', path: '/learning', actionKey: 'add_course', IconComponent: Plus, category: 'Quick Actions' },
  { id: 'act-training', type: 'action', title: 'Schedule Training Session', subtitle: 'Create a new training session on the calendar', path: '/training', actionKey: 'schedule_training', IconComponent: Calendar, category: 'Quick Actions' },
  { id: 'act-employee', type: 'action', title: 'Add Employee Record', subtitle: 'Create a new employee profile in the directory', path: '/employees', actionKey: 'add_employee', IconComponent: Plus, category: 'Quick Actions' },
  { id: 'act-ai', type: 'action', title: 'Open AI Workforce Assistant', subtitle: 'Ask questions, query analytics, or draft plans', path: null, actionKey: 'open_ai', IconComponent: Bot, category: 'Quick Actions' },
  { id: 'act-outbox', type: 'action', title: 'View Email Outbox', subtitle: 'Inspect simulated transactional emails and logs', path: null, actionKey: 'open_outbox', IconComponent: Mail, category: 'Quick Actions' },
]

export default function GlobalSearchModal({ isOpen, onClose, onOpenAiChat, onOpenOutbox }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    let active = true
    const loadData = async () => {
      setLoading(true)
      try {
        const empRes = await api.employees().catch(() => ({ employees: [] }))
        if (active) {
          setEmployees(empRes.employees || [])
        }
      } catch {
      } finally {
        if (active) setLoading(false)
      }
    }
    loadData()
    setQuery('')
    setSelectedIndex(0)
    setActiveCategory('all')
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen])

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase()

    const pages = SYSTEM_PAGES.filter(p => {
      if (!q) return true
      return p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    })

    const emps = employees.filter(e => {
      if (!q) return true
      const full = `${e.full_name || ''} ${e.department || ''} ${e.job_title || ''} ${e.employee_number || ''}`.toLowerCase()
      return full.includes(q)
    }).slice(0, 15).map(e => ({
      id: `emp-${e.id}`,
      type: 'employee',
      title: e.full_name,
      subtitle: `${e.job_title || 'Staff'} · ${e.department || 'General'} (${e.employee_number || 'ID'})`,
      path: '/employees',
      IconComponent: User,
      category: 'Employees',
      meta: {
        score: e.performance_score,
        competency: e.competency_score,
        learning: e.learning_progress,
      },
    }))

    const actions = QUICK_ACTIONS.filter(a => {
      if (!q) return true
      return a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    })

    let combined = []
    if (activeCategory === 'all') {
      if (!q) {
        combined = [...pages, ...actions]
      } else {
        combined = [...emps, ...pages, ...actions]
      }
    } else if (activeCategory === 'pages') {
      combined = pages
    } else if (activeCategory === 'employees') {
      combined = emps
    } else if (activeCategory === 'actions') {
      combined = actions
    }

    return combined
  }, [query, employees, activeCategory])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredResults.length, query, activeCategory])

  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('.global-search-item.active')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (item) => {
    if (!item) return
    onClose()
    if (item.actionKey === 'open_ai') {
      onOpenAiChat?.()
      return
    }
    if (item.actionKey === 'open_outbox') {
      onOpenOutbox?.()
      return
    }
    if (item.path) {
      navigate(item.path)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < filteredResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, filteredResults.length - 1)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex])
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="global-search-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Global Search">
      <div className="global-search-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="global-search-header">
          <div className="global-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            ref={inputRef}
            className="global-search-input"
            placeholder="Search employees, modules, workflows, or actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button className="global-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <XIcon size={16} />
            </button>
          )}
          <kbd className="global-search-esc" onClick={onClose}>ESC</kbd>
        </div>

        <div className="global-search-tabs">
          <button
            type="button"
            className={`global-search-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Results
          </button>
          <button
            type="button"
            className={`global-search-tab ${activeCategory === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveCategory('employees')}
          >
            Employees ({employees.length})
          </button>
          <button
            type="button"
            className={`global-search-tab ${activeCategory === 'pages' ? 'active' : ''}`}
            onClick={() => setActiveCategory('pages')}
          >
            Modules &amp; Pages
          </button>
          <button
            type="button"
            className={`global-search-tab ${activeCategory === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveCategory('actions')}
          >
            Quick Actions
          </button>
        </div>

        <div className="global-search-results" ref={listRef}>
          {loading && employees.length === 0 ? (
            <div className="global-search-empty">
              <Loader2 size={24} className="search-spinner-icon" style={{ animation: 'spin 1s linear infinite' }} />
              <p>Loading directory data...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="global-search-empty">
              <Search size={24} style={{ opacity: 0.4 }} />
              <b>No matching results found for "{query}"</b>
              <p>Try searching for employee names, departments, module names, or action keywords.</p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const ItemIcon = item.IconComponent
              return (
                <div
                  key={item.id}
                  className={`global-search-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="global-search-item-icon">
                    {ItemIcon ? <ItemIcon size={18} /> : null}
                  </div>
                  <div className="global-search-item-info">
                    <div className="global-search-item-title">
                      <b>{item.title}</b>
                      <span className={`global-search-badge ${item.type}`}>{item.category}</span>
                    </div>
                    <p className="global-search-item-sub">{item.subtitle}</p>
                  </div>
                  {item.meta && (
                    <div className="global-search-item-meta">
                      {item.meta.score != null && (
                        <span className="meta-pill perf" title="Performance Score">
                          <b>{item.meta.score}%</b> Perf
                        </span>
                      )}
                      {item.meta.competency != null && (
                        <span className="meta-pill comp" title="Competency Score">
                          <b>{item.meta.competency}%</b> Comp
                        </span>
                      )}
                    </div>
                  )}
                  <div className="global-search-item-arrow">
                    <span>↵</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="global-search-footer">
          <div className="global-search-shortcuts">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
          <div className="global-search-count">
            {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
          </div>
        </div>
      </div>
    </div>
  )
}
