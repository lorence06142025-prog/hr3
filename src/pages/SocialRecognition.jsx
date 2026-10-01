import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import ModuleAIInsights from '../components/ModuleAIInsights'
import {
  Heart,
  Trophy,
  Award,
  Users,
  ShieldCheck,
  Crown,
  Send,
  MessageSquare,
  Layers,
  Sparkles,
  CheckCircle2,
  Building2,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  Calendar,
  Flame,
  Star,
  TrendingUp,
  GraduationCap,
  AlertCircle,
} from 'lucide-react'
import '../recognitionWall.css'

const CORE_VALUE_TAGS = [
  { id: 'ALL', label: 'All Values', icon: Layers, tag: 'ALL' },
  { id: 'hospitality', label: 'Excellence in Hospitality', icon: Award, tag: '#ExcellenceInHospitality' },
  { id: 'guest', label: 'Guest Delight', icon: Star, tag: '#GuestDelight' },
  { id: 'teamwork', label: 'Teamwork & Integrity', icon: Users, tag: '#Teamwork' },
  { id: 'culinary', label: 'Culinary Mastery', icon: Flame, tag: '#CulinaryMastery' },
  { id: 'safety', label: 'Safety & Hygiene', icon: ShieldCheck, tag: '#SafetyFirst' },
  { id: 'leadership', label: 'Leadership in Action', icon: Crown, tag: '#Leadership' },
]

const AWARD_BADGES = [
  { name: 'Guest Delight Champion', value: 'Guest Delight', tag: '#GuestDelight', icon: Star },
  { name: 'Excellence in Hospitality', value: 'Excellence in Hospitality', tag: '#ExcellenceInHospitality', icon: Award },
  { name: 'Culinary Mastery Award', value: 'Culinary Mastery', tag: '#CulinaryMastery', icon: Flame },
  { name: 'Team Player Award', value: 'Teamwork & Integrity', tag: '#Teamwork', icon: Users },
  { name: 'Safety & Cleanliness Hero', value: 'Safety & Hygiene First', tag: '#SafetyFirst', icon: ShieldCheck },
  { name: 'Leadership in Action', value: 'Leadership in Action', tag: '#Leadership', icon: Crown },
]

export default function SocialRecognition() {
  const [feed, setFeed] = useState([])
  const [pendingNominations, setPendingNominations] = useState([])
  const [pendingCounts, setPendingCounts] = useState({ awaitingSupervisor: 0, awaitingHr: 0, totalPending: 0 })
  const [leaderboard, setLeaderboard] = useState({ topStaff: [], topDepartments: [], coreValues: [] })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark') || localStorage.getItem('pds-theme') === 'dark'
  )
  const [refreshingSpotlight, setRefreshingSpotlight] = useState(false)
  const [showResetCycleModal, setShowResetCycleModal] = useState(false)
  const [targetUpcomingMonth, setTargetUpcomingMonth] = useState(() => {
    const now = new Date()
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
    const nextMon  = now.getMonth() === 11 ? 1 : now.getMonth() + 2
    return `${nextYear}-${String(nextMon).padStart(2, '0')}`
  })
  const [resettingCycle, setResettingCycle] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('ALL')
  const [commentOpen, setCommentOpen] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [showPendingQueue, setShowPendingQueue] = useState(true)

  // Inline composer state
  const [staffList, setStaffList] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedBadge, setSelectedBadge] = useState(AWARD_BADGES[0].name)
  const [customMessage, setCustomMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [statusNotice, setStatusNotice] = useState('')
  const [noticeType, setNoticeType] = useState('success') // 'success' | 'error'
  const [userEligibility, setUserEligibility] = useState({
    canNominate: true,
    hasCompletedPerformanceEvaluation: true,
    reason: null,
  })

  // User role and RBAC
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}')
    } catch {
      return {}
    }
  })()
  const userRole = currentUser.role || 'employee'
  const isHr = userRole === 'hr' || userRole === 'operations_manager'
  const isSupervisor = userRole === 'supervisor'
  const isUpperUp = isHr || isSupervisor || userRole === 'management'
  const selectedEmployee = staffList.find((s) => s.id === selectedStaffId) || null

  const loadData = async (monthOverride) => {
    const activeMonth = monthOverride || selectedMonth
    try {
      const [feedRes, lbRes, staffRes, pendingRes] = await Promise.all([
        api.recognitionFeed().catch(() => ({ feed: [] })),
        api.recognitionLeaderboard(activeMonth).catch(() => ({ topStaff: [], topDepartments: [], coreValues: [] })),
        api.recognitionColleagues().catch(() => api.workflowSubjects()).catch(() => ({ employees: [] })),
        api.recognitionPending().catch(() => ({ pending: [], counts: { awaitingSupervisor: 0, awaitingHr: 0, totalPending: 0 } })),
      ])
      setFeed(feedRes.feed || [])
      setLeaderboard(lbRes || { topStaff: [], topDepartments: [], coreValues: [] })
      setStaffList(staffRes.employees || [])
      if (staffRes.userEligibility) {
        setUserEligibility(staffRes.userEligibility)
      }
      setPendingNominations(pendingRes.pending || [])
      setPendingCounts(pendingRes.counts || { awaitingSupervisor: 0, awaitingHr: 0, totalPending: 0 })
      if (staffRes.employees?.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffRes.employees[0].id)
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.getActiveRecognitionCycle()
      .then(res => {
        if (res.activeMonth) {
          setSelectedMonth(res.activeMonth)
          loadData(res.activeMonth)
        } else {
          loadData()
        }
      })
      .catch(() => loadData())
  }, [])

  // Keep isDark in sync with the root class when user toggles theme
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Monthly spotlight refresh handler
  const handleRefreshSpotlight = async () => {
    setRefreshingSpotlight(true)
    try {
      const res = await api.refreshRecognitionLeaderboard(selectedMonth)
      setLeaderboard(res)
      setStatusNotice(`Monthly Staff Spotlight & Department Kudos refreshed for ${res.monthLabel || 'this month'}!`)
      setTimeout(() => setStatusNotice(''), 4000)
    } catch {
      setStatusNotice('Unable to refresh monthly spotlight.')
    } finally {
      setRefreshingSpotlight(false)
    }
  }

  // Reset and activate spotlight cycle for upcoming month
  const handleResetForUpcomingMonth = async (e) => {
    if (e) e.preventDefault()
    if (!targetUpcomingMonth) return
    setResettingCycle(true)
    try {
      const res = await api.resetRecognitionCycle(targetUpcomingMonth)
      setLeaderboard(res)
      setSelectedMonth(targetUpcomingMonth)
      setShowResetCycleModal(false)
      setStatusNotice(`Recognition cycle successfully reset and activated for ${res.monthLabel}! Clean slate started.`)
      setTimeout(() => setStatusNotice(''), 5000)
    } catch {
      setStatusNotice('Unable to reset recognition cycle.')
    } finally {
      setResettingCycle(false)
    }
  }

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth)
    loadData(newMonth)
  }

  // Reaction toggling (NO EMOJIS - pure icons)
  const handleReaction = async (postId, reactionType) => {
    try {
      const res = await api.reactRecognition(postId, reactionType)
      setFeed((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, reactions: res.reactions, userReactions: res.userReactions }
            : item
        )
      )
    } catch {
      // Local optimistic update
      setFeed((prev) =>
        prev.map((item) => {
          if (item.id !== postId) return item
          const has = item.userReactions?.includes(reactionType)
          const nextUserReactions = has
            ? item.userReactions.filter((r) => r !== reactionType)
            : [...(item.userReactions || []), reactionType]
          const nextCount = Math.max(0, (item.reactions?.[reactionType] || 0) + (has ? -1 : 1))
          return {
            ...item,
            userReactions: nextUserReactions,
            reactions: { ...item.reactions, [reactionType]: nextCount },
          }
        })
      )
    }
  }

  // Comment submit
  const handleAddComment = async (postId) => {
    const text = commentDrafts[postId]?.trim()
    if (!text) return
    try {
      const res = await api.commentRecognition(postId, text)
      setFeed((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, comments: [...(item.comments || []), res.comment] }
            : item
        )
      )
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
    } catch {
      // Fallback
    }
  }

  // Submit Give Recognition / Nomination
  const handleSubmitRecognition = async (e) => {
    e.preventDefault()
    if (!selectedStaffId) return
    const targetEmployee = staffList.find((s) => s.id === selectedStaffId)
    if (!targetEmployee) return

    if (!userEligibility.canNominate) {
      setNoticeType('error')
      setStatusNotice(userEligibility.reason || 'You must complete your performance evaluation before submitting recognition nominations.')
      setTimeout(() => setStatusNotice(''), 6000)
      return
    }

    if (targetEmployee.has_completed_performance_eval === false) {
      setNoticeType('error')
      setStatusNotice(`⚠️ Cannot Nominate: ${targetEmployee.full_name} has not completed a performance evaluation yet and cannot be nominated.`)
      setTimeout(() => setStatusNotice(''), 6000)
      return
    }

    if (!customMessage.trim()) {
      setNoticeType('error')
      setStatusNotice('Please write a message explaining why you are recognizing this colleague.')
      setTimeout(() => setStatusNotice(''), 4000)
      return
    }

    const badgeConfig = AWARD_BADGES.find((b) => b.name === selectedBadge) || AWARD_BADGES[0]

    setSubmitting(true)
    try {
      const res = await api.postRecognition({
        recipientId: targetEmployee.id,
        recipientName: targetEmployee.full_name,
        recipientDepartment: targetEmployee.department,
        recipientJobTitle: targetEmployee.job_title,
        badge: badgeConfig.name,
        coreValue: badgeConfig.value,
        tag: badgeConfig.tag,
        message: customMessage.trim(),
        isOfficialAward: isUpperUp,
      })

      setCustomMessage('')
      setNoticeType('success')
      if (res.status === 'approved') {
        setStatusNotice(`Official award published on the Merit Wall for ${targetEmployee.full_name}!`)
      } else if (res.status === 'awaiting_hr') {
        setStatusNotice(`Nomination validated! Forwarded to HR Admin for final approval.`)
      } else {
        setStatusNotice(`Nomination submitted for ${targetEmployee.full_name}! It will be posted to the Merit Wall once validated by their supervisor and approved by HR.`)
      }
      await loadData()
      setTimeout(() => setStatusNotice(''), 5000)
    } catch (err) {
      setNoticeType('error')
      setStatusNotice(err?.message || 'Unable to submit recognition. Please try again.')
      setTimeout(() => setStatusNotice(''), 6000)
    } finally {
      setSubmitting(false)
    }
  }

  // Supervisor validates nomination (Step 2 -> Step 3)
  const handleValidateNomination = async (id) => {
    setProcessingId(id)
    try {
      const res = await api.validateRecognition(id)
      setStatusNotice(res.message || 'Nomination validated and sent to HR for approval!')
      await loadData()
      setTimeout(() => setStatusNotice(''), 4000)
    } catch {
      setStatusNotice('Validation failed. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  // HR reviews and gives final approval to post onto the Merit Wall! (Step 3 -> Published)
  const handleApproveNomination = async (id) => {
    setProcessingId(id)
    try {
      const res = await api.approveRecognition(id)
      setStatusNotice(res.message || 'Nomination approved and published on the Merit Wall!')
      await loadData()
      setTimeout(() => setStatusNotice(''), 4000)
    } catch {
      setStatusNotice('Approval failed. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  // Reject / decline nomination
  const handleRejectNomination = async (id) => {
    setProcessingId(id)
    try {
      const res = await api.rejectRecognition(id)
      setStatusNotice(res.message || 'Nomination declined.')
      await loadData()
      setTimeout(() => setStatusNotice(''), 4000)
    } catch {
      setStatusNotice('Decline action failed.')
    } finally {
      setProcessingId(null)
    }
  }

  const filteredFeed = feed
    .filter((item) => {
      if (selectedTag === 'ALL') return true
      return item.tag === selectedTag || item.coreValue === selectedTag
    })
    .sort((a, b) => {
      const heartsA = a.reactions?.heart || 0
      const heartsB = b.reactions?.heart || 0
      if (heartsB !== heartsA) return heartsB - heartsA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  return (
    <div className="recognition-page-wrapper">
      {/* ── HEADER & MODULE ACTIONS ────────────────────────────────────────── */}
      <div className="recognition-header-bar">
        <div className="recognition-title-area">
          <h1>Social Recognition & Merit Wall</h1>
          <p>Peer commendations, supervisor validations, and official HR awards celebrated across the hotel.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="ai-insights-toggle-btn"
            onClick={() => setShowAIInsights(!showAIInsights)}
          >
            <Sparkles size={14} />
            <span>{showAIInsights ? 'Hide AI Insights' : 'Generate AI Insights'}</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          className={`status-notice-banner ${noticeType === 'error' ? 'notice-error' : 'notice-success'}`}
          style={{
            padding: '13px 18px',
            borderRadius: 14,
            background: noticeType === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.1)',
            border: `1.5px solid ${noticeType === 'error' ? '#ef4444' : '#10b981'}`,
            color: noticeType === 'error' ? '#b91c1c' : '#059669',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {noticeType === 'error' ? (
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          )}
          <span>{statusNotice}</span>
        </div>
      )}

      {/* ── MODULE AI INSIGHTS PANEL (When activated) ────────────────────── */}
      {showAIInsights && (
        <div style={{ marginBottom: 20 }}>
          <ModuleAIInsights module="recognition" stage="Recognition Overview" />
        </div>
      )}

      {/* ── NOMINATION APPROVAL PIPELINE (Supervisor Validation & HR Review) ── */}
      {pendingNominations.length > 0 && (
        <div className="recognition-pending-section">
          <div className="pending-section-head">
            <div className="pending-section-title">
              <Clock size={18} color="#111827" />
              <span>
                {isHr
                  ? 'Nominations Awaiting HR Approval & Publishing'
                  : isSupervisor
                  ? 'Nominations Awaiting Supervisor Validation'
                  : 'My Submitted Nominations Status'}
              </span>
              <span className="pending-count-badge">
                {pendingNominations.length} Pending
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPendingQueue(!showPendingQueue)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
            >
              <span>{showPendingQueue ? 'Collapse' : 'Expand'}</span>
              {showPendingQueue ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showPendingQueue && (
            <div className="pending-nominations-grid">
              {pendingNominations.map((nom) => {
                const isAwaitingSupervisor = nom.status === 'awaiting_supervisor'
                const isAwaitingHr = nom.status === 'awaiting_hr'

                return (
                  <div key={nom.id} className="pending-nomination-card">
                    <div className="pending-card-head">
                      <div className="pending-nominee-info">
                        <b>{nom.recipientName}</b>
                        <small>{nom.recipientJobTitle} • {nom.recipientDepartment}</small>
                      </div>
                      <span className="post-badge-chip" style={{ fontSize: 10, padding: '2px 8px' }}>
                        <Award size={11} /> {nom.badge}
                      </span>
                    </div>

                    {/* Step Flow Tracker */}
                    <div className="pending-step-flow">
                      <span className="step-pill completed">1. Submitted ({nom.senderName})</span>
                      <span className={`step-pill ${isAwaitingSupervisor ? 'current' : 'completed'}`}>
                        2. Supervisor {isAwaitingSupervisor ? '⏳ Pending' : '✓ Validated'}
                      </span>
                      <span className={`step-pill ${isAwaitingHr ? 'current' : ''}`}>
                        3. HR Approval {isAwaitingHr ? '⏳ Reviewing' : ''}
                      </span>
                    </div>

                    {/* HR Validation & Review: Recognized Employee's Live Metrics */}
                    {isHr && nom.recipientMetrics && (
                      <div className="pending-metrics-panel">
                        <div className="pending-metrics-title">
                          <TrendingUp size={12} />
                          <span>Candidate Metrics (HR Validation)</span>
                        </div>
                        <div className="pending-metrics-grid">
                          <div className="pending-metric-chip metric-perf">
                            <span className="p-metric-label">Performance</span>
                            <span className="p-metric-val">{nom.recipientMetrics.performance}%</span>
                          </div>
                          <div className="pending-metric-chip metric-learn">
                            <span className="p-metric-label">Learning</span>
                            <span className="p-metric-val">{nom.recipientMetrics.learning}%</span>
                          </div>
                          <div className="pending-metric-chip metric-comp">
                            <span className="p-metric-label">Competency</span>
                            <span className="p-metric-val">{nom.recipientMetrics.competency}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="pending-message-quote">"{nom.message}"</p>

                    {/* Action buttons based on role */}
                    <div className="pending-card-actions">
                      {isSupervisor && isAwaitingSupervisor && (
                        <>
                          <button
                            type="button"
                            className="btn-validate"
                            disabled={processingId === nom.id}
                            onClick={() => handleValidateNomination(nom.id)}
                          >
                            <Check size={13} />
                            <span>{processingId === nom.id ? 'Validating…' : 'Validate & Forward to HR'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-decline"
                            disabled={processingId === nom.id}
                            onClick={() => handleRejectNomination(nom.id)}
                          >
                            <X size={13} /> Decline
                          </button>
                        </>
                      )}

                      {isHr && isAwaitingHr && (
                        <>
                          <button
                            type="button"
                            className="btn-approve-post"
                            disabled={processingId === nom.id}
                            onClick={() => handleApproveNomination(nom.id)}
                          >
                            <Sparkles size={13} />
                            <span>{processingId === nom.id ? 'Publishing…' : 'Approve & Post to Merit Wall'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-decline"
                            disabled={processingId === nom.id}
                            onClick={() => handleRejectNomination(nom.id)}
                          >
                            <X size={13} /> Decline
                          </button>
                        </>
                      )}

                      {isHr && isAwaitingSupervisor && (
                        <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> Awaiting department supervisor validation before HR publishing.
                        </div>
                      )}

                      {!isHr && !isSupervisor && (
                        <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {isAwaitingSupervisor
                            ? 'Awaiting supervisor validation.'
                            : 'Validated by supervisor; undergoing final HR approval.'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN SOCIAL RECOGNITION WALL ──────────────────────────────────── */}
      <div className="recognition-wall-layout">
        {/* Left Column: Composer + Live Stream */}
        <div>
          {/* Inline Recognition Composer */}
          <div className="recognition-composer-card">
            <div className="composer-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Heart size={16} color="#111827" />
                <span>
                  {isUpperUp
                    ? (isHr ? 'Issue Official HR Recognition' : 'Nominate / Recognize Team Member')
                    : 'Submit Public Recognition Nomination'}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: isUpperUp ? 'rgba(81, 58, 179, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                color: isUpperUp ? '#111827' : '#64748b',
                padding: '3px 10px',
                borderRadius: 20
              }}>
                {isHr ? 'Official HR Award' : isSupervisor ? 'Supervisor Nomination' : 'Peer Nomination'}
              </span>
            </div>

            {/* Performance Evaluation Prerequisite Banner (for employees who have not completed evaluation) */}
            {!userEligibility.canNominate && (
              <div className="performance-prerequisite-banner">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div className="prerequisite-icon-wrap">
                    <AlertCircle size={20} color="#b45309" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 className="prerequisite-title">Performance Evaluation Prerequisite Required</h4>
                    <p className="prerequisite-desc">
                      {userEligibility.reason || 'You must complete your performance evaluation before submitting recognition nominations.'}
                    </p>
                    <Link to="/performance" className="prerequisite-link-btn">
                      Complete Performance Evaluation
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitRecognition}>
              <div className="composer-row">
                <div>
                  <label className="recog-field-label" style={{ display: 'block', marginBottom: 5 }}>Colleague</label>
                  <select
                    className="recog-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    required
                  >
                    {staffList.map((s) => {
                      const isEligible = s.has_completed_performance_eval !== false
                      return (
                        <option key={s.id} value={s.id}>
                          {s.full_name} — {s.job_title} ({s.department}){isEligible ? '' : ' ⚠️ (Evaluation Pending)'}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="recog-field-label" style={{ display: 'block', marginBottom: 5 }}>Award Badge</label>
                  <select
                    className="recog-select"
                    value={selectedBadge}
                    onChange={(e) => setSelectedBadge(e.target.value)}
                  >
                    {AWARD_BADGES.map((b) => (
                      <option key={b.name} value={b.name}>{b.name} ({b.tag})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nominee Ineligible Warning */}
              {selectedEmployee && selectedEmployee.has_completed_performance_eval === false && (
                <div className="nominee-prerequisite-warning">
                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Cannot Nominate — Performance Evaluation Required:</strong>{' '}
                    <span>{selectedEmployee.full_name} has not completed a performance evaluation yet and cannot be nominated.</span>
                  </div>
                </div>
              )}

              {/* HR / Admin Employee Evaluation & Percentages Overview */}
              {isHr && selectedEmployee && (
                <div className="composer-employee-metrics">
                  <div className="metrics-panel-header">
                    <div className="metrics-emp-summary">
                      <div className="metrics-avatar">
                        {selectedEmployee.avatar_url ? (
                          <img src={selectedEmployee.avatar_url} alt={selectedEmployee.full_name} />
                        ) : (
                          <span>{(selectedEmployee.full_name || 'EM').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="metrics-emp-meta">
                        <span className="metrics-emp-name">{selectedEmployee.full_name}</span>
                        <span className="metrics-emp-details">{selectedEmployee.job_title} • {selectedEmployee.department}</span>
                      </div>
                    </div>
                    <div className="metrics-badge-chip">
                      <Award size={12} />
                      <span>{selectedBadge}</span>
                    </div>
                  </div>

                  <div className="metrics-cards-grid">
                    <div className="metric-tile metric-performance">
                      <div className="metric-tile-header">
                        <TrendingUp size={13} className="metric-icon" />
                        <span className="metric-label">Performance</span>
                      </div>
                      <div className="metric-val-wrap">
                        <span className="metric-val">{Number(selectedEmployee.performance_score ?? 0)}%</span>
                      </div>
                      <div className="metric-progress-track">
                        <div
                          className="metric-progress-bar bar-performance"
                          style={{ width: `${Math.min(100, Math.max(0, Number(selectedEmployee.performance_score ?? 0)))}%` }}
                        />
                      </div>
                    </div>

                    <div className="metric-tile metric-learning">
                      <div className="metric-tile-header">
                        <GraduationCap size={13} className="metric-icon" />
                        <span className="metric-label">Learning</span>
                      </div>
                      <div className="metric-val-wrap">
                        <span className="metric-val">{Number(selectedEmployee.learning_progress ?? 0)}%</span>
                      </div>
                      <div className="metric-progress-track">
                        <div
                          className="metric-progress-bar bar-learning"
                          style={{ width: `${Math.min(100, Math.max(0, Number(selectedEmployee.learning_progress ?? 0)))}%` }}
                        />
                      </div>
                    </div>

                    <div className="metric-tile metric-competency">
                      <div className="metric-tile-header">
                        <CheckCircle2 size={13} className="metric-icon" />
                        <span className="metric-label">Competency</span>
                      </div>
                      <div className="metric-val-wrap">
                        <span className="metric-val">{Number(selectedEmployee.competency_score ?? 0)}%</span>
                      </div>
                      <div className="metric-progress-track">
                        <div
                          className="metric-progress-bar bar-competency"
                          style={{ width: `${Math.min(100, Math.max(0, Number(selectedEmployee.competency_score ?? 0)))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                className="composer-textarea"
                placeholder={
                  !userEligibility.canNominate
                    ? 'Performance evaluation required before submitting nominations…'
                    : selectedEmployee && selectedEmployee.has_completed_performance_eval === false
                    ? 'Selected colleague has not completed a performance evaluation yet…'
                    : 'Share specific examples of how this colleague went above and beyond…'
                }
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={!userEligibility.canNominate}
              />
              <div className="composer-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: selectedEmployee && selectedEmployee.has_completed_performance_eval === false ? '#dc2626' : '#64748b', fontSize: 11, fontWeight: selectedEmployee && selectedEmployee.has_completed_performance_eval === false ? 600 : 400 }}>
                  {!userEligibility.canNominate
                    ? 'Complete your performance evaluation in the Performance module to unlock nominations.'
                    : selectedEmployee && selectedEmployee.has_completed_performance_eval === false
                    ? '⚠️ This colleague must complete a performance evaluation before receiving nominations.'
                    : isHr
                    ? 'HR awards publish directly to the live Merit Wall.'
                    : 'Nominations are validated by the supervisor, approved by HR, then posted.'}
                </small>
                <button
                  type="submit"
                  className="org-drawer-action-btn"
                  onClick={(e) => {
                    if (selectedEmployee && selectedEmployee.has_completed_performance_eval === false) {
                      handleSubmitRecognition(e)
                    }
                  }}
                  disabled={submitting || !userEligibility.canNominate}
                  style={
                    selectedEmployee && selectedEmployee.has_completed_performance_eval === false
                      ? { background: '#dc2626', borderColor: '#b91c1c' }
                      : undefined
                  }
                >
                  <Send size={14} />
                  <span>
                    {submitting
                      ? 'Submitting…'
                      : !userEligibility.canNominate
                      ? 'Evaluation Required to Nominate'
                      : selectedEmployee && selectedEmployee.has_completed_performance_eval === false
                      ? 'Cannot Nominate (Evaluation Required)'
                      : isHr
                      ? 'Publish Official HR Award'
                      : 'Submit Nomination'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Value Filter Pills */}
          <div className="recognition-values-bar">
            {CORE_VALUE_TAGS.map((val) => {
              const Icon = val.icon
              const isActive = selectedTag === val.tag
              return (
                <button
                  key={val.id}
                  type="button"
                  className={`value-filter-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTag(val.tag)}
                >
                  <Icon size={13} />
                  <span>{val.label}</span>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 300, justifyContent: 'center', gap: 10 }}>
              <div className="skeleton-bar" style={{ width: 140, height: 14, borderRadius: 6 }} />
              <div style={{ fontSize: 13, color: '#64748b' }}>Loading Social Recognition Feed…</div>
            </div>
          ) : filteredFeed.length === 0 ? (
            <div style={{ padding: 48, background: '#ffffff', borderRadius: 20, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <Sparkles size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>No approved recognition posts found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Be the first to recognize a colleague for their outstanding work!</div>
            </div>
          ) : (
            <div className="recognition-feed-stream">
              {filteredFeed.map((post) => {
                const initials = post.recipientName
                  ? post.recipientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'EM'
                const comments = post.comments || []
                const isCommentsOpen = commentOpen[post.id]

                return (
                  <div key={post.id} className="recognition-post-card">
                    {post.isOfficialAward && (
                      <div className="post-official-ribbon">
                        <CheckCircle2 size={12} />
                        <span>
                          {post.senderRole === 'hr' || (!post.senderRole && post.senderName?.toLowerCase().includes('hr'))
                            ? 'Official HR Award'
                            : 'Official Management Award'}
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className="post-header">
                      <div className="post-avatar">{initials}</div>
                      <div className="post-meta-wrap">
                        <div className="post-title-line">
                          {post.recipientName}
                          <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}> was recognized by </span>
                          {post.senderName}
                        </div>
                        <div className="post-subtitle-line">
                          {post.recipientJobTitle} • {post.recipientDepartment}
                        </div>
                      </div>
                    </div>

                    {/* Badge and Tag */}
                    <div className="post-badge-strip">
                      <span className="post-badge-chip">
                        <Award size={13} />
                        <span>{post.badge}</span>
                      </span>
                      <span className="post-hashtag-chip">
                        <span>{post.tag}</span>
                      </span>
                    </div>

                    {/* Message */}
                    <div className="post-message-body">{post.message}</div>

                    {/* Icon Reaction Bar (STRICTLY HEART AND TROPHY/BADGE ONLY) */}
                    <div className="post-reaction-bar">
                      {/* 1. Heart */}
                      <button
                        type="button"
                        className={`reaction-icon-btn ${post.userReactions?.includes('heart') ? 'reacted' : ''}`}
                        onClick={() => handleReaction(post.id, 'heart')}
                        title="Heart Appreciation (Boosts to Top of Merit Wall)"
                      >
                        <Heart size={14} />
                        <span>{post.reactions?.heart || 0}</span>
                      </button>

                      {/* 2. Trophy / Merit Badge */}
                      <button
                        type="button"
                        className={`reaction-icon-btn ${post.userReactions?.includes('trophy') ? 'reacted' : ''}`}
                        onClick={() => handleReaction(post.id, 'trophy')}
                        title="Top Performance Award Trophy"
                      >
                        <Trophy size={14} />
                        <span>{post.reactions?.trophy || 0}</span>
                      </button>

                      {/* Comments Count Toggle */}
                      <button
                        type="button"
                        className="post-comments-toggle"
                        onClick={() =>
                          setCommentOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                      >
                        <MessageSquare size={14} />
                        <span>{comments.length} Comments</span>
                      </button>
                    </div>

                    {/* Comments Panel */}
                    {isCommentsOpen && (
                      <div className="post-comments-panel">
                        {comments.map((c) => (
                          <div key={c.id} className="comment-row">
                            <div className="comment-author">{c.userName} ({c.userRole})</div>
                            <div>{c.text}</div>
                          </div>
                        ))}

                        <div className="comment-input-row">
                          <input
                            type="text"
                            placeholder="Write a congratulatory comment…"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(post.id)
                            }}
                          />
                          <button
                            type="button"
                            className="comment-send-btn"
                            onClick={() => handleAddComment(post.id)}
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Leaderboard & Department Kudos */}
        <div className="recognition-sidebar-column">
          {/* Top Recognized Staff */}
          <div className="recognition-leaderboard-card">
            <div className="leaderboard-header-row">
              <div className="leaderboard-title">
                <Trophy size={18} color="#111827" />
                <span>Monthly Staff Spotlight</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="leaderboard-refresh-btn"
                  onClick={handleRefreshSpotlight}
                  disabled={refreshingSpotlight}
                  title="Refresh Monthly Staff Spotlight and Kudos"
                >
                  <RefreshCw size={12} className={refreshingSpotlight ? 'animate-spin' : ''} />
                  <span>{refreshingSpotlight ? 'Refreshing…' : 'Refresh'}</span>
                </button>
                {isHr && (
                  <button
                    type="button"
                    className="leaderboard-reset-cycle-btn"
                    onClick={() => setShowResetCycleModal(true)}
                    title="Reset and activate upcoming month cycle"
                  >
                    <RotateCcw size={12} />
                    <span>Reset for Upcoming Month</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="leaderboard-month-badge">
                  <Clock size={11} /> {leaderboard.monthLabel || 'Current Month'}
                </span>
                {leaderboard.isActiveCycle ? (
                  <span className="leaderboard-cycle-active-pill">● Active Cycle</span>
                ) : (
                  <span className="leaderboard-cycle-archived-pill">Archived</span>
                )}
              </div>
              <input
                type="month"
                className="leaderboard-month-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                title="Select month to view spotlight"
              />
            </div>

            {(!leaderboard.topStaff || leaderboard.topStaff.length === 0) ? (
              <div className="leaderboard-empty-cycle">
                <Sparkles size={26} color="#6b7280" style={{ marginBottom: 6 }} />
                <div className="leaderboard-empty-title">{leaderboard.monthLabel} Cycle Active!</div>
                <div className="leaderboard-empty-sub">
                  All staff heart & kudos tallies are clean at 0. Start recognizing colleagues to see them rise in this month's Spotlight!
                </div>
                <button
                  type="button"
                  className="leaderboard-empty-action-btn"
                  onClick={() => {
                    document.querySelector('.recognition-composer-card')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Heart size={12} />
                  <span>Give First Recognition</span>
                </button>
              </div>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.topStaff?.map((staff, idx) => (
                  <div key={staff.name} className="leaderboard-item">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="rank-badge">{idx + 1}</span>
                      <div>
                        <div className="leaderboard-item-name">{staff.name}</div>
                        <div className="leaderboard-item-sub">{staff.jobTitle ? `${staff.jobTitle} • ` : ''}{staff.department}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="leaderboard-item-count" title="Hearts Received" style={{ color: '#ec4899' }}>
                        <Heart size={12} style={{ fill: '#ec4899', color: '#ec4899' }} />
                        <span>{staff.heartsCount || 0}</span>
                      </div>
                      <div className="leaderboard-item-count" title="Total Kudos / Awards">
                        <Award size={13} />
                        <span>{staff.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Department Kudos Leaderboard */}
          <div className="recognition-leaderboard-card">
            <div className="leaderboard-header-row">
              <div className="leaderboard-title">
                <Building2 size={18} color="#111827" />
                <span>Department Kudos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="leaderboard-month-badge">
                  {leaderboard.monthLabel || 'Monthly'}
                </span>
                {leaderboard.isResetOrUpcoming && (
                  <span className="leaderboard-cycle-active-pill" style={{ fontSize: 9 }}>New Cycle</span>
                )}
              </div>
            </div>
            <div className="leaderboard-list">
              {leaderboard.topDepartments?.map((dept) => (
                <div key={dept.department} className="leaderboard-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={15} />
                    <span className="leaderboard-item-name">{dept.department}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: dept.totalKudos > 0 ? '#059669' : '#94a3b8' }}>
                    {dept.totalKudos} kudos
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: RESET & ACTIVATE SPOTLIGHT CYCLE FOR UPCOMING MONTH ────── */}
      {/* ── MODAL: RESET & ACTIVATE SPOTLIGHT CYCLE (via Portal so it always centers on screen) ── */}
      {showResetCycleModal && isHr && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(5, 7, 18, 0.78)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowResetCycleModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              background: isDark ? '#1e293b' : '#ffffff',
              borderRadius: 20,
              padding: '28px 28px 24px',
              boxShadow: isDark
                ? '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.2)'
                : '0 20px 60px rgba(0,0,0,0.18)',
              border: isDark ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(226,232,240,0.8)',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                <RotateCcw size={18} color="#111827" />
                <span>Reset for Upcoming Month</span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetCycleModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', display: 'flex' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              Resetting for an upcoming month activates a{' '}
              <b style={{ color: isDark ? '#d1d5db' : '#111827' }}>clean slate</b> for that cycle.
              All staff hearts and department kudos start at <b>0</b>, and previous month
              rankings are safely preserved in the archive.
            </p>

            <form onSubmit={handleResetForUpcomingMonth}>
              {/* Month Input */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 7, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Target Upcoming Month
                </label>
                <input
                  type="month"
                  value={targetUpcomingMonth}
                  onChange={(e) => setTargetUpcomingMonth(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 10,
                    border: isDark ? '1.5px solid rgba(167,139,250,0.35)' : '1.5px solid #cbd5e1',
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#e2e8f0' : '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                    colorScheme: isDark ? 'dark' : 'light',
                  }}
                />
              </div>

              {/* Quick month pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {(() => {
                  const options = []
                  const now = new Date()
                  for (let i = 1; i <= 3; i++) {
                    const y = now.getMonth() + i > 11 ? now.getFullYear() + Math.floor((now.getMonth() + i) / 12) : now.getFullYear()
                    const m = (now.getMonth() + i) % 12
                    const d = new Date(y, m, 1)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
                    options.push({ key, label })
                  }
                  const isSelected = (k) => targetUpcomingMonth === k
                  return options.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTargetUpcomingMonth(opt.key)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '5px 14px',
                        borderRadius: 999,
                        border: isSelected(opt.key)
                          ? '1.5px solid #111827'
                          : isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                        background: isSelected(opt.key)
                          ? isDark ? 'rgba(17,24,39,0.22)' : 'rgba(17,24,39,0.1)'
                          : isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                        color: isSelected(opt.key)
                          ? isDark ? '#d1d5db' : '#111827'
                          : isDark ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                })()}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowResetCycleModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                    fontSize: 13,
                    fontWeight: 700,
                    color: isDark ? '#94a3b8' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingCycle || !targetUpcomingMonth}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #111827 0%, #111827 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: resettingCycle ? 'not-allowed' : 'pointer',
                    opacity: resettingCycle ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <RotateCcw size={13} className={resettingCycle ? 'animate-spin' : ''} />
                  <span>{resettingCycle ? 'Activating…' : 'Reset & Start Upcoming Month'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}



