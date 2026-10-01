import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import AIReport from '../components/AIReport'
import ModuleAIInsights from '../components/ModuleAIInsights'
import TrainingAttendanceQRModal from '../components/TrainingAttendanceQRModal'
import EmployeeAttendanceQRModal from '../components/EmployeeAttendanceQRModal'
import { CheckCircle, AlertTriangle, X, Trash2, Star, QrCode, Camera, ShieldCheck, UserCheck } from 'lucide-react'
import '../trainingCalendar.css'

const CATEGORIES = ['Customer Service', 'Fleet Safety', 'Leadership', 'Compliance', 'Dispatch Operations', 'Warehouse Operations', 'Technical Skills']

export default function TrainingManagement() {
  const [activeTab, setActiveTab] = useState('active') // 'active', 'archived', 'overview'
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'cards'
  const [sessions, setSessions] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [overviewStats, setOverviewStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())

  // Modal / Drawer States
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrSessionTarget, setQrSessionTarget] = useState(null)
  const [showEmployeeQRModal, setShowEmployeeQRModal] = useState(false)
  const [employeeQRInitialTab, setEmployeeQRInitialTab] = useState('my_badge')
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [aiReportData, setAiReportData] = useState(null)
  const [generatingAi, setGeneratingAi] = useState(false)

  // Session Form State
  const [newSession, setNewSession] = useState({
    title: '',
    category: CATEGORIES[0],
    venue: '',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    capacity: 30,
    budget: 5000,
    trainer: '',
    department: 'All Departments',
    description: '',
  })
  const [savingSession, setSavingSession] = useState(false)

  // Participant Search & Selection
  const [selectedEmpIds, setSelectedEmpIds] = useState([])
  const [empSearch, setEmpSearch] = useState('')
  const [empDeptFilter, setEmpDeptFilter] = useState('')
  const [inviting, setInviting] = useState(false)

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState({})
  const [savingAttendance, setSavingAttendance] = useState(false)

  // Evaluation Form State
  const [evalForm, setEvalForm] = useState({
    employeeId: '',
    relevance: 5,
    trainerRating: 5,
    contentQuality: 5,
    overallRating: 5,
    comments: '',
  })
  const [submittingEval, setSubmittingEval] = useState(false)

  // User Role & Employee ID
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}')
    } catch {
      return {}
    }
  })()
  const role = currentUser.role || 'employee'
  const isHr = role === 'hr'
  const isOpsManager = role === 'operations_manager'
  const isSupervisor = role === 'supervisor'
  const canManageSessions = isHr
  const canInvite = isHr || isSupervisor
  const canRecordAttendance = isHr || isSupervisor || isOpsManager
  const canCompleteSession = isHr || isOpsManager

  // Fetch real sessions from database
  const loadSessions = async () => {
    setLoading(true)
    try {
      const [sessRes, empRes] = await Promise.all([
        api.trainingSessions().catch(() => ({ sessions: [] })),
        api.employees().catch(() => ({ employees: [] })),
      ])
      setSessions(sessRes.sessions || [])
      setEmployees(empRes.employees || [])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load training sessions.')
    } finally {
      setLoading(false)
    }
  }

  // Silently refresh session counts WITHOUT showing the loading spinner
  // Used after attendance scans so the numbers update instantly on screen
  const silentRefreshSessions = async () => {
    try {
      const sessRes = await api.trainingSessions().catch(() => ({ sessions: [] }))
      setSessions(sessRes.sessions || [])
    } catch {}
  }

  const loadOverviewStats = async () => {
    setLoadingStats(true)
    try {
      const res = await api.trainingStats().catch(() => null)
      if (res) setOverviewStats(res)
    } catch (_) {}
    finally { setLoadingStats(false) }
  }

  useEffect(() => {
    void loadSessions()
    void loadOverviewStats()

    // Handle instant self-check-in when opening via scanned QR link (?checkin=SESSION_ID)
    try {
      const params = new URLSearchParams(window.location.search)
      const checkinSessionId = params.get('checkin')
      if (checkinSessionId) {
        api.selfCheckinTrainingSession(checkinSessionId)
          .then(res => {
            if (res.success) {
              setNotice(res.message || '✓ Your attendance is recorded! You are marked PRESENT for this training session.')
              void loadSessions()
            }
          })
          .catch(err => {
            setError(err.message || 'Self check-in failed. Please check your login session.')
          })
          .finally(() => {
            const cleanUrl = window.location.pathname + window.location.hash
            window.history.replaceState({}, document.title, cleanUrl)
          })
      }
    } catch {}
  }, [])

  // Load single session detail with real participants
  const loadSessionDetail = async sessionId => {
    try {
      const res = await api.trainingSession(sessionId)
      const detail = {
        ...res.session,
        participants: res.participants || [],
      }
      setSelectedSessionDetail(detail)
      setSelectedSession(detail)
      // Map participants attendance into state
      const attMap = {}
      ;(res.participants || []).forEach(p => {
        attMap[p.employee_id] = p.attendance
      })
      setAttendanceRecords(attMap)
      return res
    } catch (err) {
      setError(err.message || 'Failed to load session details.')
    }
  }

  const openSessionDetailModal = async session => {
    setSelectedSession(session)
    setShowDetailModal(true)
    await loadSessionDetail(session.id)
  }

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startingDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days = []
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const dateObj = new Date(year, month - 1, d)
      const mStr = String(dateObj.getMonth() + 1).padStart(2, '0')
      const dStr = String(d).padStart(2, '0')
      days.push({
        dateStr: `${dateObj.getFullYear()}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false,
      })
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(d).padStart(2, '0')
      const dateStr = `${year}-${monthStr}-${dayStr}`
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      })
    }

    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length
    for (let j = 1; j <= remaining; j++) {
      const dateObj = new Date(year, month + 1, j)
      const mStr = String(dateObj.getMonth() + 1).padStart(2, '0')
      const dStr = String(j).padStart(2, '0')
      days.push({
        dateStr: `${dateObj.getFullYear()}-${mStr}-${dStr}`,
        dayNum: j,
        isCurrentMonth: false,
      })
    }
    return days
  }, [currentDate])

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const monthYearLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  // Handle Session Creation
  const handleCreateSession = async e => {
    e.preventDefault()
    setSavingSession(true)
    setError('')
    try {
      const res = await api.createTrainingSession(newSession)
      setNotice(`Training session "${res.session.title}" created successfully!`)
      setShowScheduleModal(false)
      setNewSession({
        title: '',
        category: CATEGORIES[0],
        venue: '',
        startDate: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        capacity: 30,
        budget: 5000,
        trainer: '',
        department: 'All Departments',
        description: '',
      })
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await loadSessions()
    } catch (err) {
      setError(err.message || 'Failed to save training session.')
    } finally {
      setSavingSession(false)
    }
  }

  // Handle Participant Invitations
  const handleInviteSubmit = async e => {
    e.preventDefault()
    if (!selectedSession || selectedEmpIds.length === 0) return
    setInviting(true)
    setError('')
    try {
      const res = await api.inviteTrainingParticipants(selectedSession.id, selectedEmpIds)
      setNotice(res.message || 'Participants invited successfully!')
      setShowInviteModal(false)
      setSelectedEmpIds([])
      await loadSessionDetail(selectedSession.id)
      await loadSessions()
      await loadOverviewStats()
    } catch (err) {
      setError(err.message || 'Failed to invite participants.')
    } finally {
      setInviting(false)
    }
  }

  // Handle Attendance Save
  const handleSaveAttendance = async () => {
    if (!selectedSession || !selectedSessionDetail) return
    const records = Object.entries(attendanceRecords).map(([employeeId, attendance]) => ({
      employeeId,
      attendance,
    }))
    if (records.length === 0) return

    setSavingAttendance(true)
    try {
      const res = await api.recordTrainingAttendance(selectedSession.id, records)
      setNotice(res.message || 'Attendance records saved.')
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await loadSessionDetail(selectedSession.id)
      await loadSessions()
      await loadOverviewStats()
    } catch (err) {
      setError(err.message || 'Failed to save attendance.')
    } finally {
      setSavingAttendance(false)
    }
  }

  // Bulk Mark Attendance
  const handleBulkAttendance = status => {
    if (!selectedSessionDetail) return
    const updated = { ...attendanceRecords }
    ;(selectedSessionDetail.participants || []).forEach(p => {
      updated[p.employee_id] = status
    })
    setAttendanceRecords(updated)
  }

  // Handle Evaluation Submit
  const handleEvalSubmit = async e => {
    e.preventDefault()
    if (!selectedSession || !evalForm.employeeId) return
    setSubmittingEval(true)
    setError('')
    try {
      const res = await api.submitTrainingEvaluation(selectedSession.id, evalForm)
      setNotice(res.message || 'Evaluation submitted.')
      await loadSessionDetail(selectedSession.id)
      await loadOverviewStats()
    } catch (err) {
      setError(err.message || 'Failed to submit evaluation.')
    } finally {
      setSubmittingEval(false)
    }
  }

  // Handle Session Completion with Validation
  const handleCompleteSession = async () => {
    if (!selectedSession) return
    setError('')
    try {
      const res = await api.completeTrainingSession(selectedSession.id)
      setNotice(res.message || 'Session completed.')
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await loadSessionDetail(selectedSession.id)
      await loadSessions()
      await loadOverviewStats()
    } catch (err) {
      setError(err.message || 'Session cannot be completed.')
    }
  }

  // Handle Load Analytics & AI Insights
  const handleViewAnalytics = async session => {
    setSelectedSession(session)
    setShowAnalyticsModal(true)
    setAnalyticsData(null)
    setAiReportData(null)
    try {
      const res = await api.trainingSessionAnalytics(session.id)
      setAnalyticsData(res.metrics)
    } catch (err) {
      setError(err.message || 'Failed to calculate analytics.')
    }
  }

  const handleGenerateAi = async () => {
    if (!selectedSession) return
    setGeneratingAi(true)
    try {
      const res = await api.generateTrainingAiInsights(selectedSession.id)
      setAiReportData(res.report)
    } catch (err) {
      setError(err.message || 'Failed to generate AI insights.')
    } finally {
      setGeneratingAi(false)
    }
  }

  // Filtered employees for invitation list
  const filteredEmployeesForInvite = useMemo(() => {
    const existingEmpIds = (selectedSessionDetail?.participants || []).map(p => p.employee_id)
    return employees.filter(e => {
      if (existingEmpIds.includes(e.id)) return false
      if (empDeptFilter && e.department !== empDeptFilter) return false
      if (empSearch && !`${e.full_name} ${e.department} ${e.job_title}`.toLowerCase().includes(empSearch.toLowerCase())) return false
      return true
    })
  }, [employees, selectedSessionDetail, empDeptFilter, empSearch])

  // Active / Upcoming sessions (scheduled or ongoing)
  const activeSessions = useMemo(() => {
    return sessions.filter(s => {
      const st = String(s.status || '').toLowerCase()
      return st !== 'completed' && st !== 'cancelled'
    })
  }, [sessions])

  // Archived sessions (completed or cancelled)
  const archivedSessions = useMemo(() => {
    return sessions.filter(s => {
      const st = String(s.status || '').toLowerCase()
      return st === 'completed' || st === 'cancelled'
    })
  }, [sessions])

  // Derived live Overview panels from stats OR live sessions array fallback
  const overviewUpcoming = useMemo(() => {
    if (overviewStats?.upcoming?.length) return overviewStats.upcoming
    return activeSessions
  }, [overviewStats, activeSessions])

  const overviewRecentCompleted = useMemo(() => {
    if (overviewStats?.recentCompleted?.length) return overviewStats.recentCompleted
    return sessions.filter(s => String(s.status).toLowerCase() === 'completed')
  }, [overviewStats, sessions])

  const overviewByCategory = useMemo(() => {
    if (overviewStats?.byCategory?.length) return overviewStats.byCategory
    if (!sessions.length) return []
    const counts = {}
    const completedCounts = {}
    sessions.forEach(s => {
      counts[s.category] = (counts[s.category] || 0) + 1
      if (String(s.status).toLowerCase() === 'completed') {
        completedCounts[s.category] = (completedCounts[s.category] || 0) + 1
      }
    })
    return Object.keys(counts).map(cat => ({
      category: cat,
      count: counts[cat],
      completed: completedCounts[cat] || 0,
    }))
  }, [overviewStats, sessions])

  const overviewTopAttendance = useMemo(() => {
    if (overviewStats?.topAttendance?.length) return overviewStats.topAttendance
    const completed = sessions.filter(s => String(s.status).toLowerCase() === 'completed')
    if (!completed.length) return []
    return completed.map(s => {
      const reg = Number(s.registered_count || 0)
      const pres = Number(s.present_count || 0)
      const pct = reg > 0 ? Math.round((pres / reg) * 100) : 0
      return {
        id: s.id,
        title: s.title,
        category: s.category,
        present_count: pres,
        registered_count: reg,
        attendance_pct: pct,
      }
    }).sort((a, b) => b.attendance_pct - a.attendance_pct)
  }, [overviewStats, sessions])

  return (
    <main className="module-workspace training-workspace">
      {/* Header Bar */}
      <div className="module-heading">
        <div>
          <h1>Training Management & Calendar</h1>
          <p>Schedule sessions, view interactive calendar, track attendance, and evaluate training effectiveness.</p>
        </div>
        <div className="module-heading-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="session-action-btn"
            style={{ background: '#111827', color: '#ffffff', border: 'none', padding: '8px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8, boxShadow: '0 2px 10px rgba(17, 24, 39, 0.25)' }}
            onClick={() => {
              setEmployeeQRInitialTab('my_badge')
              setShowEmployeeQRModal(true)
            }}
          >
            <QrCode size={14} className="inline mr-1" /> My Attendance QR Badge
          </button>
          <button
            type="button"
            className="session-action-btn"
            style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)', padding: '8px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8 }}
            onClick={() => {
              setEmployeeQRInitialTab('scan_session')
              setShowEmployeeQRModal(true)
            }}
          >
            <Camera size={14} className="inline mr-1" /> Scan Session QR
          </button>
          {canManageSessions && (
            <button className="module-primary" onClick={() => setShowScheduleModal(true)}>
              + Create Training Session
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
      {notice && (
        <div className="module-notice">
          <span><CheckCircle className="inline w-4 h-4 mr-1 text-emerald-500" /> {notice}</span>
          <button type="button" className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button>
        </div>
      )}
      {error && (
        <div className="module-error" role="alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle className="w-4 h-4 text-amber-500" /> {error}</span>
          <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 'bold' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="learning-tabs training-nav-tabs" aria-label="Training views" style={{ marginBottom: 20 }}>
        <button
          className={activeTab === 'active' ? 'active' : ''}
          onClick={() => setActiveTab('active')}
        >
          Training Calendar & Sessions ({activeSessions.length})
        </button>
        <button
          className={activeTab === 'archived' ? 'active' : ''}
          onClick={() => setActiveTab('archived')}
        >
          Archived Sessions ({archivedSessions.length})
        </button>
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Training Analytics & Overview
        </button>
      </nav>

      {/* TAB 1: UNIFIED ACTIVE CALENDAR & SESSIONS VIEW */}
      {activeTab === 'active' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'inline-flex', background: 'rgba(17, 24, 39, 0.08)', padding: 3, borderRadius: 8, gap: 4 }}>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'calendar' ? '#ffffff' : 'transparent',
                  color: viewMode === 'calendar' ? '#5a45c2' : '#64748b',
                  boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Calendar View
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: viewMode === 'cards' ? '#5a45c2' : '#64748b',
                  boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Card Grid View ({activeSessions.length})
              </button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <div className="calendar-view-card">
              <div className="calendar-header-nav">
                <h3 className="calendar-month-title">{monthYearLabel}</h3>
                <div className="month-nav-btns">
                  <button className="month-nav-btn" onClick={handlePrevMonth}>← Prev Month</button>
                  <button className="month-nav-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
                  <button className="month-nav-btn" onClick={handleNextMonth}>Next Month →</button>
                </div>
              </div>

              <div className="calendar-grid-header">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              <div className="calendar-grid-body">
                {calendarDays.map((day, idx) => {
                  const daySessions = activeSessions.filter(s => String(s.start_date).slice(0, 10) === day.dateStr)
                  return (
                    <div
                      key={idx}
                      className={`calendar-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''}`}
                    >
                      <span className="day-number">{day.dayNum}</span>
                      <div className="calendar-events-list">
                        {daySessions.map(sess => (
                          <div
                            key={sess.id}
                            className={`calendar-event-chip ${sess.category.toLowerCase().replace(/\s+/g, '-')}`}
                            title={`${sess.title} @ ${sess.venue} (${sess.registered_count || 0}/${sess.capacity})`}
                            onClick={() => openSessionDetailModal(sess)}
                          >
                            {sess.title} ({sess.registered_count || 0}/{sess.capacity})
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {activeSessions.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>No upcoming active training sessions scheduled.</p>
                  <p style={{ fontSize: 13 }}>Completed sessions are stored in the <b>Archived Sessions</b> tab.</p>
                  {canManageSessions && (
                    <button className="schedule-new-btn" style={{ marginTop: 12 }} onClick={() => setShowScheduleModal(true)}>
                      + Create Training Session
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="training-sessions-grid">
              {activeSessions.map(session => {
                const regCount = Number(session.registered_count || 0)
                const pct = Math.round((regCount / session.capacity) * 100)
                return (
                  <div key={session.id} className="session-card">
                    <div>
                      <div className="session-card-head">
                        <span className="session-category-tag">{session.category}</span>
                        <span className={`session-status-badge ${session.status}`}>
                          {session.status.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="session-title">{session.title}</h3>
                      <div className="session-meta-list">
                        <div className="session-meta-item">
                          <span>Venue:</span> <b>{session.venue}</b>
                        </div>
                        <div className="session-meta-item">
                          <span>Date:</span> <b>{String(session.start_date).slice(0, 10)} ({session.start_time})</b>
                        </div>
                        <div className="session-meta-item">
                          <span>Trainer:</span> <span>{session.trainer || 'HR Specialist'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="session-progress-bar">
                        <div className="session-progress-text">
                          <span>Capacity Utilization</span>
                          <b>{regCount} / {session.capacity} ({pct}%)</b>
                        </div>
                        <div className="session-bar-track">
                          <div className="session-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>

                      {/* Attendance Breakdown Pills */}
                      <div className="session-attendance-breakdown" style={{ display: 'flex', gap: 6, margin: '10px 0 14px 0', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                          Present: {session.present_count || 0}
                        </span>
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                          Absent: {session.absent_count || 0}
                        </span>
                        <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                          Late: {session.late_count || 0}
                        </span>
                      </div>

                      <div className="session-card-actions">
                        <button className="session-action-btn primary" onClick={() => openSessionDetailModal(session)}>
                          Manage Session
                        </button>
                        {canRecordAttendance && session.status !== 'cancelled' && session.status !== 'completed' && (
                          <button
                            type="button"
                            className="session-action-btn"
                            style={{ background: 'rgba(17, 24, 39, 0.08)', color: '#111827', borderColor: 'rgba(17, 24, 39, 0.3)' }}
                            onClick={() => {
                              setQrSessionTarget(session)
                              setShowQRModal(true)
                            }}
                          >
                            <QrCode size={13} className="inline mr-1" /> QR Scanner
                          </button>
                        )}
                        {!canRecordAttendance && session.status !== 'cancelled' && session.status !== 'completed' && (
                          <button
                            type="button"
                            className="session-action-btn"
                            style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                            onClick={() => {
                              setEmployeeQRInitialTab('scan_session')
                              setShowEmployeeQRModal(true)
                            }}
                          >
                            <Camera size={13} className="inline mr-1" /> Check In
                          </button>
                        )}
                        <button className="session-action-btn" onClick={() => handleViewAnalytics(session)}>
                          Analytics & AI
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {activeSessions.length === 0 && !loading && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>No active training sessions.</p>
                  <p style={{ fontSize: 13 }}>All completed sessions are safely stored in the <b>Archived Sessions</b> tab.</p>
                  {canManageSessions && (
                    <button className="schedule-new-btn" style={{ marginTop: 12 }} onClick={() => setShowScheduleModal(true)}>
                      + Schedule Training Session
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: ARCHIVED SESSIONS VIEW (Completed & Cancelled) */}
      {activeTab === 'archived' && (
        <div className="training-sessions-grid">
          {archivedSessions.map(session => {
            const regCount = Number(session.registered_count || 0)
            const pct = session.capacity > 0 ? Math.round((regCount / session.capacity) * 100) : 0
            const isCompleted = session.status === 'completed'
            return (
              <div key={session.id} className="session-card archived-session-card">
                <div>
                  <div className="session-card-head">
                    <span className="session-category-tag">{session.category}</span>
                    <span className={`session-status-badge ${session.status}`}>
                      {session.status === 'completed' ? 'COMPLETED' : session.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="session-title">{session.title}</h3>
                  <div className="session-meta-list">
                    <div className="session-meta-item">
                      <span>Venue:</span> <b>{session.venue}</b>
                    </div>
                    <div className="session-meta-item">
                      <span>Held on:</span> <b>{String(session.start_date).slice(0, 10)} ({session.start_time})</b>
                    </div>
                    <div className="session-meta-item">
                      <span>Trainer:</span> <span>{session.trainer || 'HR Specialist'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="session-progress-bar">
                    <div className="session-progress-text">
                      <span>Final Attendance Rate</span>
                      <b>{regCount > 0 ? `${Math.round(((session.present_count || 0) / regCount) * 100)}%` : '0%'} ({session.present_count || 0}/{regCount} attended)</b>
                    </div>
                    <div className="session-bar-track">
                      <div
                        className="session-bar-fill"
                        style={{
                          width: `${regCount > 0 ? Math.min(100, Math.round(((session.present_count || 0) / regCount) * 100)) : 0}%`,
                          background: isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : '#94a3b8'
                        }}
                      />
                    </div>
                  </div>

                  {/* Attendance Breakdown Pills */}
                  <div className="session-attendance-breakdown" style={{ display: 'flex', gap: 6, margin: '10px 0 14px 0', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      Present: {session.present_count || 0}
                    </span>
                    <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                      Absent: {session.absent_count || 0}
                    </span>
                    <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                      Late: {session.late_count || 0}
                    </span>
                  </div>

                  <div className="session-card-actions">
                    <button className="session-action-btn" onClick={() => openSessionDetailModal(session)}>
                      View Records
                    </button>
                    <button className="session-action-btn primary" onClick={() => handleViewAnalytics(session)}>
                      Analytics & AI
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {archivedSessions.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>No archived sessions yet.</p>
              <p style={{ fontSize: 13 }}>When training sessions are completed or cancelled, they will automatically be archived here.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRAINING OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="training-overview-dashboard">

          {/* KPI STAT CARDS */}
          <section className="module-metrics" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 20 }}>
            {[
              { label: 'Total Sessions', value: overviewStats?.summary?.total_sessions ?? sessions.length },
              { label: 'Active / Upcoming', value: overviewStats?.summary?.active_sessions ?? sessions.filter(s => s.status === 'scheduled').length },
              { label: 'Completed', value: overviewStats?.summary?.completed_sessions ?? sessions.filter(s => s.status === 'completed').length },
              { label: 'Total Participants', value: overviewStats?.summary?.total_participants ?? '—' },
              { label: 'Present Count', value: overviewStats?.summary?.total_present ?? sessions.reduce((acc, s) => acc + Number(s.present_count || 0), 0) },
              { label: 'Absent Count', value: overviewStats?.summary?.total_absent ?? sessions.reduce((acc, s) => acc + Number(s.absent_count || 0), 0) },
              { label: 'Late Count', value: overviewStats?.summary?.total_late ?? sessions.reduce((acc, s) => acc + Number(s.late_count || 0), 0) },
              { label: 'Attendance Rate', value: overviewStats?.summary?.attendance_rate != null ? `${overviewStats.summary.attendance_rate}%` : '—' },
              { label: 'Satisfaction Rate', value: overviewStats?.summary?.satisfaction_rate != null ? `${overviewStats.summary.satisfaction_rate}%` : '—' },
            ].map((stat, i) => (
              <article key={stat.label}>
                <span>{i + 1}</span>
                <div>
                  <small>{stat.label}</small>
                  <b>{loadingStats ? '...' : stat.value}</b>
                  <em>Live database value</em>
                </div>
              </article>
            ))}
          </section>

          {/* TWO COLUMN GRID: MAIN PANELS ON LEFT, AI INSIGHTS SIDEBAR ON RIGHT */}
          <div className="module-grid overview-grid">
            {/* LEFT COLUMN */}
            <div className="module-main-col" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* UPCOMING & RECENT COMPLETIONS */}
              <div className="overview-two-col">
                {/* Upcoming Sessions */}
                <div className="overview-panel">
                  <div className="overview-panel-head">
                    <h3>Upcoming Sessions <span className="panel-sub">(Scheduled & Active)</span></h3>
                    <button className="overview-refresh-btn" onClick={() => { void loadSessions(); void loadOverviewStats(); }} disabled={loadingStats}>Refresh</button>
                  </div>
                  {loadingStats && !sessions.length ? <p className="overview-empty">Loading…</p> : (
                    overviewUpcoming.length ? (
                      <div className="overview-sessions-list">
                        {overviewUpcoming.map(s => (
                          <div key={s.id} className="overview-session-row">
                            <div className="overview-session-badge" style={{ background: '#f3f4f6', color: '#111827' }}>
                              {String(s.start_date).slice(5, 10)}
                            </div>
                            <div className="overview-session-info">
                              <b>{s.title}</b>
                              <small>{s.venue} · {s.start_time?.slice(0,5)} · {s.registered_count || 0}/{s.capacity} registered</small>
                            </div>
                            <span className="overview-category-chip">{s.category}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="overview-empty">No sessions scheduled in the database yet.</p>
                    )
                  )}
                </div>

                {/* Recent Completions */}
                <div className="overview-panel">
                  <div className="overview-panel-head">
                    <h3>Recently Completed</h3>
                  </div>
                  {loadingStats && !sessions.length ? <p className="overview-empty">Loading…</p> : (
                    overviewRecentCompleted.length ? (
                      <div className="overview-sessions-list">
                        {overviewRecentCompleted.map(s => {
                          const reg = Number(s.registered_count || 0)
                          const pres = Number(s.present_count || 0)
                          const pct = reg > 0 ? Math.round((pres / reg) * 100) : 0
                          return (
                            <div key={s.id} className="overview-session-row">
                              <div className="overview-session-badge" style={{ background: '#f0fdf4', color: '#059669' }}>
                                {pct}%
                              </div>
                              <div className="overview-session-info">
                                <b>{s.title}</b>
                                <small>
                                  {s.venue} · {String(s.start_date).slice(0,10)} · 
                                  <span style={{ color: '#16a34a', fontWeight: 600 }}> {s.present_count || 0} Present</span> · 
                                  <span style={{ color: '#dc2626', fontWeight: 600 }}> {s.absent_count || 0} Absent</span> · 
                                  <span style={{ color: '#d97706', fontWeight: 600 }}> {s.late_count || 0} Late</span>
                                </small>
                              </div>
                              <span className="overview-category-chip" style={{ background: '#dcfce7', color: '#059669' }}>{s.category}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="overview-empty">No completed sessions yet.</p>
                    )
                  )}
                </div>
              </div>

              {/* CATEGORY BREAKDOWN + TOP ATTENDANCE */}
              <div className="overview-two-col">
                {/* Category Breakdown */}
                <div className="overview-panel">
                  <div className="overview-panel-head">
                    <h3>Sessions by Category</h3>
                  </div>
                  {overviewByCategory.length ? (
                    <div className="overview-category-list">
                      {overviewByCategory.map(c => {
                        const total = sessions.length || 1
                        const pct = Math.round((c.count / total) * 100)
                        return (
                          <div key={c.category} className="overview-cat-row">
                            <span className="overview-cat-name">{c.category}</span>
                            <div className="overview-cat-bar-wrap">
                              <div className="overview-cat-bar" style={{ width: `${Math.max(pct, 4)}%`, background: '#111827' }} />
                            </div>
                            <span className="overview-cat-count">{c.count} <small>({c.completed} done)</small></span>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="overview-empty">No sessions data available.</p>}
                </div>

                {/* Top Attendance */}
                <div className="overview-panel">
                  <div className="overview-panel-head">
                    <h3>Top Attendance Sessions</h3>
                  </div>
                  {overviewTopAttendance.length ? (
                    <div className="overview-sessions-list">
                      {overviewTopAttendance.map((s, idx) => (
                        <div key={s.id} className="overview-session-row">
                          <div className="overview-session-badge" style={{ background: idx === 0 ? '#fef9c3' : '#f3f4f6', color: idx === 0 ? '#b45309' : '#374151', fontWeight: 700 }}>
                            #{idx + 1}
                          </div>
                          <div className="overview-session-info">
                            <b>{s.title}</b>
                            <small>{s.present_count}/{s.registered_count} attended</small>
                          </div>
                          <span style={{ fontWeight: 700, color: s.attendance_pct >= 80 ? '#059669' : '#d97706', minWidth: 40, textAlign: 'right' }}>{s.attendance_pct}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="overview-empty">No completed session data yet.</p>}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR: UNIFORM MODULE AI INSIGHTS PANEL */}
            <ModuleAIInsights module="training" stage="Training Overview" />
          </div>

        </div>
      )}

      {/* MODAL 1: CREATE NEW SESSION */}
      {showScheduleModal && (
        <div className="training-modal-overlay">
          <div className="training-modal-content">
            <div className="training-modal-header">
              <h3>Create Training Session</h3>
              <button className="training-modal-close" onClick={() => setShowScheduleModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreateSession}>
              <div className="training-modal-body">
                <label className="form-field">
                  <span>Training Session Title *</span>
                  <input
                    type="text"
                    required
                    value={newSession.title}
                    onChange={e => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder="e.g. Food Safety and Hygiene Training"
                  />
                </label>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Category / Training Type *</span>
                    <select
                      value={newSession.category}
                      onChange={e => setNewSession({ ...newSession, category: e.target.value })}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Target Department</span>
                    <select
                      value={newSession.department}
                      onChange={e => setNewSession({ ...newSession, department: e.target.value })}
                    >
                      <option value="All Departments">All Departments</option>
                      <option value="Customer Service">Customer Service</option>
                      <option value="Warehouse & Inventory">Warehouse & Inventory</option>
                      <option value="Dispatch & Routing">Dispatch & Routing</option>
                      <option value="Fleet & Transportation">Fleet & Transportation</option>
                      <option value="Engineering">Engineering</option>
                    </select>
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Start Date *</span>
                    <input
                      type="date"
                      required
                      value={newSession.startDate}
                      onChange={e => setNewSession({ ...newSession, startDate: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Start Time *</span>
                    <input
                      type="time"
                      required
                      value={newSession.startTime}
                      onChange={e => setNewSession({ ...newSession, startTime: e.target.value })}
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Venue / Room Location *</span>
                    <input
                      type="text"
                      required
                      value={newSession.venue}
                      onChange={e => setNewSession({ ...newSession, venue: e.target.value })}
                      placeholder="e.g. Training Room A"
                    />
                  </label>

                  <label className="form-field">
                    <span>Trainer / Facilitator</span>
                    <input
                      type="text"
                      value={newSession.trainer}
                      onChange={e => setNewSession({ ...newSession, trainer: e.target.value })}
                      placeholder="e.g. Maria Santos"
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Capacity (Max Participants)</span>
                    <input
                      type="number"
                      min={1}
                      value={newSession.capacity}
                      onChange={e => setNewSession({ ...newSession, capacity: Number(e.target.value) })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Budget (PHP)</span>
                    <input
                      type="number"
                      min={0}
                      value={newSession.budget}
                      onChange={e => setNewSession({ ...newSession, budget: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>Description / Objectives</span>
                  <textarea
                    rows={3}
                    value={newSession.description}
                    onChange={e => setNewSession({ ...newSession, description: e.target.value })}
                    placeholder="Describe training topics, learning objectives, or requirements..."
                  />
                </label>
              </div>

              <div className="form-actions" style={{ padding: '0 24px 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="session-action-btn" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="session-action-btn primary" disabled={savingSession}>
                  {savingSession ? 'Saving Session...' : 'Save Training Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SESSION DETAILS & PARTICIPANT MANAGMENT */}
      {showDetailModal && selectedSession && selectedSessionDetail && (
        <div className="training-modal-overlay">
          <div className="training-modal-content" style={{ maxWidth: 720 }}>
            <div className="training-modal-header">
              <div>
                <h3>{selectedSessionDetail.title}</h3>
                <small style={{ color: '#6b7280' }}>
                  {String(selectedSessionDetail.start_date).slice(0, 10)} @ {selectedSessionDetail.venue} ({selectedSessionDetail.status.toUpperCase()})
                </small>
              </div>
              <button className="training-modal-close" onClick={() => setShowDetailModal(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="training-modal-body">
              {/* Session Overview Stats */}
              <div className="training-detail-stats-grid">
                <div><small className="stat-label">Category</small><br/><b>{selectedSessionDetail.category}</b></div>
                <div><small className="stat-label">Capacity</small><br/><b>{selectedSessionDetail.capacity} participants</b></div>
                <div><small className="stat-label">Trainer</small><br/><b>{selectedSessionDetail.trainer || 'HR'}</b></div>
                <div><small className="stat-label">Status</small><br/><b style={{ textTransform: 'capitalize' }}>{selectedSessionDetail.status}</b></div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canInvite && selectedSessionDetail.status !== 'completed' && selectedSessionDetail.status !== 'cancelled' && (
                  <button className="session-action-btn primary" onClick={() => setShowInviteModal(true)}>
                    + Invite Participants
                  </button>
                )}
                {canRecordAttendance && selectedSessionDetail.status !== 'cancelled' && selectedSessionDetail.status !== 'completed' && (
                  <button
                    type="button"
                    className="session-action-btn"
                    style={{ background: '#111827', color: '#ffffff', border: 'none', boxShadow: '0 2px 8px rgba(17, 24, 39, 0.3)' }}
                    onClick={() => {
                      setQrSessionTarget(selectedSessionDetail)
                      setShowQRModal(true)
                    }}
                  >
                    <QrCode size={13} className="inline mr-1" /> Live QR Attendance Scanner
                  </button>
                )}
                {canCompleteSession && selectedSessionDetail.status === 'scheduled' && (
                  <button className="session-action-btn primary" style={{ background: '#10b981' }} onClick={handleCompleteSession}>
                    Mark Session Completed
                  </button>
                )}
                {isHr && selectedSessionDetail.status !== 'cancelled' && (
                  <button className="session-action-btn session-btn-cancel" onClick={async () => {
                    if (confirm('Are you sure you want to cancel this training session?')) {
                      try {
                        await api.cancelTrainingSession(selectedSession.id)
                        setNotice('Session cancelled.')
                        await loadSessionDetail(selectedSession.id)
                        await loadSessions()
                      } catch (err) { setError(err.message) }
                    }
                  }}>
                    Cancel Session
                  </button>
                )}
              </div>

              {/* Participant List Table & Attendance */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>Participants ({(selectedSessionDetail.participants || []).length} / {selectedSessionDetail.capacity})</h4>
                  {canRecordAttendance && (selectedSessionDetail.participants || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="att-status-btn present" onClick={() => handleBulkAttendance('present')}>
                        Mark All Present
                      </button>
                      <button className="session-action-btn primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleSaveAttendance} disabled={savingAttendance}>
                        {savingAttendance ? 'Saving...' : 'Save Attendance'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="attendance-table-wrap">
                  <table className="attendance-sheet-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Attendance Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSessionDetail.participants || []).map(p => (
                        <tr key={p.employee_id}>
                          <td><b>{p.full_name}</b><br/><small className="text-muted-sub">{p.job_title}</small></td>
                          <td>{p.department}</td>
                          <td>
                            {canRecordAttendance ? (
                              <div className="attendance-status-btn-group">
                                {['present', 'absent', 'late', 'excused'].map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    className={`att-status-btn ${st} ${(attendanceRecords[p.employee_id] || p.attendance) === st ? 'active' : ''}`}
                                    onClick={() => setAttendanceRecords({ ...attendanceRecords, [p.employee_id]: st })}
                                  >
                                    {st.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className={`session-status-badge ${p.attendance}`}>{p.attendance.toUpperCase()}</span>
                            )}
                          </td>
                          <td>
                            {canInvite && (
                              <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }} onClick={async () => {
                                try {
                                  await api.removeTrainingParticipant(selectedSession.id, p.employee_id)
                                  await loadSessionDetail(selectedSession.id)
                                } catch (err) { setError(err.message) }
                               }}><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Remove</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(selectedSessionDetail.participants || []).length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No participants invited yet. Click "+ Invite Participants" to add employees.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Evaluation Form section for logged in employee */}
              {(selectedSessionDetail.participants || []).some(p => p.employee_id === currentUser.employeeId) && (
                <div className="training-eval-card">
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>
                      Submit Training Effectiveness Evaluation
                    </h4>
                    <p style={{ margin: 0, fontSize: 13 }} className="text-muted-sub">
                      Rate the relevance, trainer quality, and content of this training session.
                    </p>
                  </div>

                  <form onSubmit={handleEvalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      {[
                        { key: 'relevance', label: 'Relevance' },
                        { key: 'trainerRating', label: 'Trainer Rating' },
                        { key: 'contentQuality', label: 'Content Quality' },
                        { key: 'overallRating', label: 'Overall Rating' },
                      ].map(metric => (
                        <div key={metric.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{metric.label}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1, 2, 3, 4, 5].map(num => {
                              const selected = (evalForm[metric.key] || 5) === num
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setEvalForm({ ...evalForm, [metric.key]: num, employeeId: currentUser.employeeId })}
                                  style={{
                                    flex: 1,
                                    padding: '6px 0',
                                    border: selected ? '1px solid #111827' : '1px solid #d1d5db',
                                    background: selected ? '#111827' : '#ffffff',
                                    color: selected ? '#ffffff' : '#374151',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                   <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{num}<Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Feedback & Comments (Optional)</span>
                      <textarea
                        rows={3}
                        placeholder="Share your thoughts on how this training will help in your daily role..."
                        value={evalForm.comments}
                        onChange={e => setEvalForm({ ...evalForm, comments: e.target.value, employeeId: currentUser.employeeId })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 13,
                          fontFamily: 'inherit',
                          color: '#111827',
                          background: '#ffffff',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={submittingEval}
                        style={{
                          background: '#29282D',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '10px 20px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {submittingEval ? 'Submitting Evaluation...' : 'Submit Evaluation'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: INVITE PARTICIPANTS */}
      {showInviteModal && selectedSession && (
        <div className="training-modal-overlay">
          <div className="training-modal-content">
            <div className="training-modal-header">
              <h3>Invite Participants to "{selectedSession.title}"</h3>
              <button className="training-modal-close" onClick={() => setShowInviteModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleInviteSubmit}>
              <div className="training-modal-body">
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Search by employee name or title..."
                    value={empSearch}
                    onChange={e => setEmpSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    value={empDeptFilter}
                    onChange={e => setEmpDeptFilter(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Warehouse & Inventory">Warehouse & Inventory</option>
                    <option value="Dispatch & Routing">Dispatch & Routing</option>
                    <option value="Fleet & Transportation">Fleet & Transportation</option>
                  </select>
                </div>

                <div className="training-invite-list">
                  {filteredEmployeesForInvite.map(emp => {
                    const checked = selectedEmpIds.includes(emp.id)
                    return (
                      <label key={emp.id} className={`invite-emp-row${checked ? ' checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedEmpIds(checked ? selectedEmpIds.filter(id => id !== emp.id) : [...selectedEmpIds, emp.id])}
                        />
                        <div>
                          <b>{emp.full_name}</b> — <small className="text-muted-sub">{emp.job_title} ({emp.department})</small>
                        </div>
                      </label>
                    )
                  })}
                  {filteredEmployeesForInvite.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94a3b8', margin: 10 }}>No matching employees available for invitation.</p>
                  )}
                </div>
              </div>

              <div className="form-actions" style={{ padding: '0 24px 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="session-action-btn" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="session-action-btn primary" disabled={inviting || selectedEmpIds.length === 0}>
                  {inviting ? 'Inviting...' : `Invite Selected (${selectedEmpIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ANALYTICS & AI REPORT */}
      {showAnalyticsModal && selectedSession && (
        <div className="training-modal-overlay">
          <div className="training-modal-content" style={{ maxWidth: 680 }}>
            <div className="training-modal-header">
              <h3>Training Analytics & AI Insights</h3>
              <button className="training-modal-close" onClick={() => setShowAnalyticsModal(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="training-modal-body">
              {analyticsData ? (
                <div>
                  <h4 style={{ margin: '0 0 10px 0' }}>Real Session Metrics (Database)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                    <div className="training-metric-box neutral">
                      <small>Total Participants</small><br/>
                      <b style={{ fontSize: 18 }}>{analyticsData.totalParticipants}</b>
                    </div>
                    <div className="training-metric-box green">
                      <small>Attendance Rate</small><br/>
                      <b style={{ fontSize: 18 }}>{analyticsData.attendanceRate}%</b>
                    </div>
                    <div className="training-metric-box blue">
                      <small>Avg Effectiveness</small><br/>
                      <b style={{ fontSize: 18 }}>{analyticsData.avgOverallRating} / 5</b>
                    </div>
                    <div className="training-metric-box amber">
                      <small>Capacity Util.</small><br/>
                      <b style={{ fontSize: 18 }}>{analyticsData.capacityUtilization}%</b>
                    </div>
                  </div>

                  {/* AI Generator Button */}
                  <div className="training-ai-brief-banner">
                    <div>
                      <b>AI Training Insights Brief</b>
                      <p style={{ margin: 0, fontSize: 12 }}>Grounded strictly in completed database metrics.</p>
                    </div>
                    <button className="session-action-btn primary" onClick={handleGenerateAi} disabled={generatingAi}>
                      {generatingAi ? 'Generating...' : 'Generate AI Insights'}
                    </button>
                  </div>

                  {aiReportData && (
                    <div className="training-ai-report-wrap">
                      <AIReport
                        title={aiReportData.title || 'AI Executive Brief'}
                        content={typeof aiReportData.content === 'string' ? aiReportData.content : JSON.stringify(aiReportData, null, 2)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94a3b8' }}>Calculating database metrics...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LIVE ATTENDANCE QR CODE SCANNER & SESSION DISPLAY (FOR HR / TRAINERS) */}
      {showQRModal && qrSessionTarget && (
        <TrainingAttendanceQRModal
          session={qrSessionTarget}
          employees={employees}
          onClose={() => {
            setShowQRModal(false)
            setQrSessionTarget(null)
          }}
          onAttendanceUpdated={async () => {
            // Update participant list in the detail modal instantly
            if (selectedSessionDetail && selectedSessionDetail.id === qrSessionTarget.id) {
              void loadSessionDetail(qrSessionTarget.id)
            }
            // Refresh counts on cards instantly, no spinner
            void silentRefreshSessions()
          }}
        />
      )}

      {/* MODAL 6: EMPLOYEE DIGITAL ATTENDANCE BADGE & SELF CHECK-IN SCANNER */}
      {showEmployeeQRModal && (
        <EmployeeAttendanceQRModal
          user={currentUser}
          activeSessions={sessions}
          onClose={() => setShowEmployeeQRModal(false)}
          onAttendanceUpdated={() => {
            // Instantly refresh counts on session cards, no spinner
            void silentRefreshSessions()
          }}
        />
      )}
    </main>
  )
}
