import React, { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon, sectionsByRole } from './Sidebar'
import { api } from '../lib/api'
import EmailOutboxDrawer from './EmailOutboxDrawer'
import TwoFactorModal from './TwoFactorModal'
import UserProfileModal from './UserProfileModal'
import GlobalSearchModal from './GlobalSearchModal'
import { BarChart3, Target, GraduationCap, Calendar, Crown, Trophy, Bell, Check, Sparkles, Mail, BellOff, Clock } from 'lucide-react'

function getNotifMeta(item) {
  const t = (item.title || '').toLowerCase()
  if (t.includes('performance')) return { IconComponent: BarChart3, color: '#111827', bg: '#f0ebff', label: 'Performance' }
  if (t.includes('competency') || t.includes('skill')) return { IconComponent: Target, color: '#0284c7', bg: '#e0f2fe', label: 'Competency' }
  if (t.includes('learning')) return { IconComponent: GraduationCap, color: '#16a34a', bg: '#dcfce7', label: 'Learning' }
  if (t.includes('training')) return { IconComponent: Calendar, color: '#d97706', bg: '#fef3c7', label: 'Training' }
  if (t.includes('succession')) return { IconComponent: Crown, color: '#111827', bg: '#f3e8ff', label: 'Succession' }
  if (t.includes('recognition')) return { IconComponent: Trophy, color: '#e11d48', bg: '#ffe4e6', label: 'Recognition' }
  return { IconComponent: Bell, color: '#5e48c0', bg: '#efebff', label: 'Workflow' }
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatSessionTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 300))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function Header({ user, onToggle, dark, onOpenMobileNav, onOpenAiChat, sessionSecondsLeft, onResetSession }) {
  // ── All useState hooks first (React rules of hooks) ──
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [outboxOpen, setOutboxOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [headerAvatar, setHeaderAvatar] = useState(user?.avatarUrl || null)
  const [expandedId, setExpandedId] = useState(null)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeNavGroup, setActiveNavGroup] = useState(null)
  const roleNavRef = useRef(null)

  // ── All useEffect hooks after useState ──

  useEffect(() => {
    if (user?.avatarUrl) setHeaderAvatar(user.avatarUrl)
  }, [user?.avatarUrl])

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.avatarUrl !== undefined) {
        setHeaderAvatar(e.detail.avatarUrl)
      }
    }
    window.addEventListener('pds:user-updated', handleUpdate)
    return () => window.removeEventListener('pds:user-updated', handleUpdate)
  }, [])

  // Global Ctrl+K shortcut to open search
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const result = await api.notifications()
        if (active) {
          setNotifications(result.notifications || [])
          setUnread(result.unread || 0)
        }
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!activeNavGroup) return undefined
    const closeOnOutsideClick = (event) => {
      if (!roleNavRef.current?.contains(event.target)) setActiveNavGroup(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActiveNavGroup(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [activeNavGroup])

  const canSeeOutbox = user?.role === 'hr' || user?.role === 'management'

  const showNotifications = async () => {
    setOpen(value => !value)
    if (!open && unread > 0) {
      try {
        await api.readNotifications()
        setUnread(0)
        setNotifications(items => items.map(item => ({ ...item, is_read: true })))
      } catch {}
    }
  }

  const markAllRead = async (e) => {
    e.stopPropagation()
    try {
      await api.readNotifications()
      setUnread(0)
      setNotifications(items => items.map(item => ({ ...item, is_read: true })))
    } catch {}
  }

  const displayNotifs = notifFilter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications
  const roleNavSections = sectionsByRole[user?.role] || sectionsByRole.employee

  return <>
    <header className="topbar">
      <div className="topbar-main">
        <div className="crumb">
          <span className="crumb-brand">Priority Handling Services, Inc.</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">Performance &amp; Development</span>
        </div>

        <div className="top-actions">
        <button className="mobile-menu-btn" type="button" onClick={onOpenMobileNav} aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <button
          type="button"
          className="search topbar-search topbar-search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="Open search"
        >
          <Icon name="search" size={16} />
          <span className="topbar-search-placeholder">Search employees, workflows, reports...</span>
          <kbd className="search-shortcut-badge">Ctrl K</kbd>
        </button>

        {/* AI Assistant header button hidden for clean UI */}

        {canSeeOutbox && (
          <button
            className="header-pill-btn outbox-pill"
            type="button"
            onClick={() => setOutboxOpen(true)}
            title="Live Email Outbox Inspector"
          >
            <span><Mail size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Outbox</span>
          </button>
        )}

        {user?.role !== 'operations_manager' && (
          <button
            className="header-icon-btn"
            type="button"
            onClick={() => setProfileOpen(true)}
            title="My Profile & Settings"
          >
            <Icon name="settings" size={17} />
          </button>
        )}

        {/* Notifications Bell */}
        <button
          className="header-icon-btn notif-bell"
          type="button"
          onClick={showNotifications}
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          title="Notifications"
        >
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>

        {/* Session Inactivity Countdown Timer (Starts at 05:00) */}
        <div
          className={`topbar-clock-pill ${sessionSecondsLeft != null && sessionSecondsLeft <= 60 ? (sessionSecondsLeft <= 15 ? 'session-pill-urgent' : 'session-pill-warning') : ''}`}
          title="Session Inactivity Timer (auto-logouts after 5 minutes of idle time). Click to extend."
          onClick={onResetSession}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          role="button"
          tabIndex={0}
        >
          <Clock size={13} className={sessionSecondsLeft != null && sessionSecondsLeft <= 60 ? 'session-clock-urgent' : ''} />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {formatSessionTime(sessionSecondsLeft)}
          </span>
        </div>

        {/* Animated Sun / Moon Theme Toggle */}
        <button
          className="theme-switch-btn"
          type="button"
          onClick={(e) => onToggle(e)}
          aria-pressed={dark}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="theme-icon-indicator">
            {dark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </span>
        </button>

        {/* User Avatar with Status Indicator */}
        <div
          className="topbar-avatar-wrapper"
          title={`${user?.name || 'User'} (${user?.role || ''}) — Click to edit profile`}
          onClick={() => setProfileOpen(true)}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setProfileOpen(true)}
        >
          {(headerAvatar || user?.avatarUrl) ? (
            <img
              src={headerAvatar || user?.avatarUrl}
              alt={user?.name || 'User'}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: '1.5px solid rgba(255,255,255,0.85)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            />
          ) : (
            <span className="avatar avatar-lia">
              {user?.name ? (user.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() : 'HR'}
            </span>
          )}
          <span className="topbar-online-dot" />
        </div>
        </div>
      </div>

      <nav className="role-nav" aria-label="Main navigation" ref={roleNavRef}>
        {roleNavSections.map((section) => (
          <div className="role-nav-group" key={section.title}>
            <button
              type="button"
              className={`role-nav-trigger ${activeNavGroup === section.title ? 'is-open' : ''}`}
              aria-expanded={activeNavGroup === section.title}
              onClick={() => setActiveNavGroup((openGroup) => openGroup === section.title ? null : section.title)}
            >
              {section.title}
              <Icon name="chevron" size={15} />
            </button>
            {activeNavGroup === section.title && (
              <div className="role-nav-panel">
                {section.links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `role-nav-link ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveNavGroup(null)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </header>

    {/* Professional Notification Panel Dropdown */}
    {open && (
      <>
        <div className="notif-popover-backdrop" onClick={() => setOpen(false)} />
        <div className="notif-panel-box">
          {/* Header */}
          <div className="notif-panel-head">
            <div className="notif-panel-title-wrap">
              <h2>Notifications</h2>
              {unread > 0 && <span className="notif-unread-count-tag">{unread} unread</span>}
            </div>
            <div className="notif-panel-actions">
              {unread > 0 && (
                <button className="notif-btn-text flex items-center gap-1" onClick={markAllRead}>
                  <Check className="w-3.5 h-3.5 inline" />
                  <span>Mark all read</span>
                </button>
              )}
              <button className="notif-close-icon" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="notif-panel-tabs">
            <button
              className={`notif-tab ${notifFilter === 'all' ? 'active' : ''}`}
              onClick={() => setNotifFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`notif-tab ${notifFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setNotifFilter('unread')}
            >
              Unread ({unread})
            </button>
          </div>

          {/* List Content */}
          <div className="notif-panel-body">
            {displayNotifs.length > 0 ? (
              displayNotifs.map(item => {
                const meta = getNotifMeta(item)
                const isExpanded = expandedId === item.id
                return (
                  <article
                    key={item.id}
                    className={`notif-card-item ${item.is_read ? 'is-read' : 'is-unread'} ${isExpanded ? 'is-expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="notif-card-icon" style={{ background: meta.bg, color: meta.color }}>
                      <meta.IconComponent size={16} />
                    </div>
                    <div className="notif-card-main">
                      <div className="notif-card-header">
                        <span className="notif-card-badge" style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                        <span className="notif-card-time">{timeAgo(item.created_at)}</span>
                      </div>
                      <h4 className="notif-card-title">{item.title}</h4>
                      <p className="notif-card-desc">{item.message}</p>

                      {isExpanded && (
                        <div className="notif-card-expanded-details">
                          <div className="notif-detail-block">
                            <span className="notif-detail-lbl">Description &amp; Action Required:</span>
                            <p>{item.message || 'Complete the step required for this workflow process.'}</p>
                          </div>
                          {item.workflow_id && (
                            <div className="notif-detail-block">
                              <span className="notif-detail-lbl">Workflow Reference:</span>
                              <code>#{item.workflow_id.slice(0, 8)}</code>
                            </div>
                          )}
                          <div className="notif-detail-timestamp">
                            Dispatched: {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    {!item.is_read && <span className="notif-unread-blue-dot" />}
                  </article>
                )
              })
            ) : (
              <div className="notif-empty-container">
                <div className="notif-empty-icon"><BellOff size={28} style={{ opacity: 0.4 }} /></div>
                <b>{notifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</b>
                <p>Workflow notifications and action items will appear here automatically.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="notif-panel-foot">
            <small>Priority Handling Services, Inc.</small>
            <button onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      </>
    )}

    <EmailOutboxDrawer isOpen={outboxOpen} onClose={() => setOutboxOpen(false)} />
    {twoFactorOpen && <TwoFactorModal onClose={() => setTwoFactorOpen(false)} />}
    {profileOpen && <UserProfileModal onClose={() => setProfileOpen(false)} />}
    <GlobalSearchModal
      isOpen={searchOpen}
      onClose={() => setSearchOpen(false)}
      onOpenAiChat={onOpenAiChat}
      onOpenOutbox={() => setOutboxOpen(true)}
    />
  </>
}
