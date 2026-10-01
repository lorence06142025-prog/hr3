import React, { lazy, Suspense, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import MobileNav from './components/MobileNav'
import Header from './components/Header'
import SessionWarning from './components/SessionWarning'
import LiveToast from './components/LiveToast'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import './index.css'
import './buttonStyles.css'
import './employeeSearch.css'
import './login.css'
import './moduleAi.css'
import './roleHome.css'
import './roleControls.css'
import './certificate.css'
import './certificateUpload.css'
import './employeeRecords.css'
import Login from './pages/Login'
import './learningLibrary.css'
import './animations.css'
import './darkModeFixes.css'
import './interactiveWorkflow.css'
import './responsive.css'
import './brandTheme.css'
import AIAnalytics from './pages/AIAnalytics'
import RoleHome from './pages/RoleHome'

// Lazy-load secondary module pages so each is downloaded on-demand
const PerformanceManagement = lazy(() => import('./pages/PerformanceManagement'))
const CompetencyManagement = lazy(() => import('./pages/CompetencyManagement'))
const LearningManagement = lazy(() => import('./pages/LearningManagement'))
const TrainingManagement = lazy(() => import('./pages/TrainingManagement'))
const SuccessionPlanning = lazy(() => import('./pages/SuccessionPlanning'))
const SocialRecognition = lazy(() => import('./pages/SocialRecognition'))
const CertificateManagement = lazy(() => import('./pages/CertificateManagement'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
const EmployeeManagement = lazy(() => import('./pages/EmployeeManagement'))
const OrgChart = lazy(() => import('./pages/OrgChart'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const ReportsHub = lazy(() => import('./pages/ReportsHub'))
const Register = lazy(() => import('./pages/Register'))
const AIChatDrawer = lazy(() => import('./components/AIChatDrawer'))

// Global React Error Boundary to catch any rendering errors and prevent blank screens
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('App runtime error caught by boundary:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', color: '#0f172a', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: 540, width: '100%', background: '#ffffff', borderRadius: 16, padding: 32, boxShadow: '0 10px 25px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: '#ef4444' }}>Rendering Issue Detected</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 }}>
              The application encountered a component error while rendering:
            </p>
            <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto', color: '#334155', marginBottom: 20, fontFamily: 'monospace' }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                style={{ flex: 1, padding: '10px 16px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Reload View
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('pds-token')
                  localStorage.removeItem('pds-user')
                  window.location.replace('/')
                }}
                style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Return to Login
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Dimension-locked page skeleton matching rendered module geometry
function PageSkeleton() {
  return (
    <div
      className="page-skeleton-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '32px 38px 60px',
        maxWidth: 1420,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        flex: '1 0 auto',
        minHeight: 'calc(100vh - 72px)',
      }}
    >
      {/* Header bar shimmer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, marginBottom: 4 }}>
        <div>
          <div className="skeleton-bar" style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton-bar" style={{ width: 240, height: 26, borderRadius: 8 }} />
        </div>
        <div className="skeleton-bar" style={{ width: 120, height: 38, borderRadius: 8 }} />
      </div>
      {/* 5 KPI Stat cards shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-bar" style={{ height: 120, borderRadius: 12 }} />
        ))}
      </div>
      {/* Middle content / chart shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div className="skeleton-bar" style={{ height: 280, borderRadius: 14 }} />
        <div className="skeleton-bar" style={{ height: 280, borderRadius: 14 }} />
      </div>
      {/* Bottom table shimmer */}
      <div className="skeleton-bar" style={{ height: 180, borderRadius: 14 }} />
    </div>
  )
}

// Module and page content router with smooth animated transition on route change
function ModuleRoutes({ user }) {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const mainEl = document.querySelector('.fixed-main')
    if (mainEl) mainEl.scrollTop = 0
  }, [location.pathname])

  // Eagerly preload all lazy page chunks right after the app shell renders
  // so every sidebar navigation is instant (chunks already in browser cache)
  useEffect(() => {
    const t = setTimeout(() => {
      import('./pages/PerformanceManagement')
      import('./pages/CompetencyManagement')
      import('./pages/LearningManagement')
      import('./pages/TrainingManagement')
      import('./pages/SuccessionPlanning')
      import('./pages/SocialRecognition')
      import('./pages/OrgChart')
      import('./pages/CertificateManagement')
      import('./pages/EmployeeManagement')
      import('./pages/AuditLogs')
      import('./components/AIChatDrawer')
    }, 1500) // 1.5s after mount — let the current page render first
    return () => clearTimeout(t)
  }, []) // only once

  return (
    <div key={location.pathname} className="page-transition-wrapper">
      <Suspense fallback={<PageSkeleton />}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              ['hr', 'operations_manager'].includes(user.role) ? (
                <AIAnalytics key={`analytics-${user.id}`} />
              ) : (
                <RoleHome key={`home-${user.id}`} role={user.role} name={user.name} />
              )
            }
          />
          <Route path="/performance" element={<PerformanceManagement key={`perf-${user.id}`} />} />
          <Route path="/competency" element={<CompetencyManagement key={`comp-${user.id}`} />} />
          <Route path="/learning" element={<LearningManagement key={`learn-${user.id}`} />} />
          <Route path="/training" element={<TrainingManagement key={`train-${user.id}`} />} />
          <Route
            path="/succession"
            element={
              ['hr', 'supervisor', 'management', 'operations_manager'].includes(user.role) ? (
                <SuccessionPlanning key={`succ-${user.id}`} />
              ) : (
                <RoleHome key={`home-${user.id}`} role={user.role} name={user.name} />
              )
            }
          />
          <Route path="/recognition" element={<SocialRecognition key={`recog-${user.id}`} />} />
          <Route path="/orgchart" element={<OrgChart key={`org-${user.id}`} />} />
          <Route
            path="/certificates"
            element={
              ['hr', 'employee', 'supervisor', 'operations_manager'].includes(user.role) ? (
                <CertificateManagement key={`cert-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/employees"
            element={
              ['hr', 'operations_manager', 'supervisor'].includes(user.role) ? (
                <EmployeeManagement key={`emp-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/reports" element={<ReportsHub key={`reports-${user.id}`} />} />
          <Route
            path="/audit"
            element={
              ['hr', 'operations_manager', 'management'].includes(user.role) ? (
                <AuditLogs key={`audit-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('pds-token')
      if (!token) return null
      return JSON.parse(localStorage.getItem('pds-user') || 'null')
    } catch {
      return null
    }
  })
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('pds-theme') === 'dark'
    } catch {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [sessionNotice, setSessionNotice] = useState('')
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(null) // null = hidden
  useEffect(() => {
    const handleExpired = (e) => {
      handleLogout(e.detail?.message || 'Your session has expired. Please sign in again.')
    }
    window.addEventListener('pds:session-expired', handleExpired)
    return () => window.removeEventListener('pds:session-expired', handleExpired)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('pds-theme', dark ? 'dark' : 'light')
    } catch (err) { void err }
  }, [dark])

  // View Transitions API toggle — smooth circular ripple (FleetOps-style)
  const handleThemeToggle = (e) => {
    // Ripple origin: centre of the toggle button
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top  + rect.height / 2 : window.innerHeight / 2

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth  - x),
      Math.max(y, window.innerHeight - y)
    )

    // Fallback for browsers without View Transitions API
    if (!document.startViewTransition) {
      setDark((s) => !s)
      return
    }

    // flushSync forces React to update the DOM synchronously inside the callback,
    // so the API captures the correct before → after snapshots
    const transition = document.startViewTransition(() => {
      flushSync(() => setDark((s) => !s))
    })

    // Once both snapshots are ready, run the clip-path circle animation
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',  // Material-style smooth
          pseudoElement: '::view-transition-new(root)',
        }
      )
    })
  }

  // Sync user profile on mount to ensure avatarUrl is up-to-date
  useEffect(() => {
    if (!user?.id) return
    api.getProfileMe().then((res) => {
      const liveAvatar = res.user?.avatarUrl || res.employee?.avatarUrl || res.user?.avatar_url || res.employee?.avatar_url || null
      if (liveAvatar) {
        setUser((prev) => {
          if (!prev || prev.avatarUrl === liveAvatar) return prev
          const updated = { ...prev, avatarUrl: liveAvatar }
          try { localStorage.setItem('pds-user', JSON.stringify(updated)) } catch {}
          return updated
        })
      }
    }).catch(() => {})
  }, [user?.id])

  // Listen for instant profile/avatar updates
  useEffect(() => {
    const handleUserUpdate = (e) => {
      if (e.detail?.avatarUrl !== undefined) {
        setUser((prev) => {
          if (!prev) return prev
          const updated = { ...prev, avatarUrl: e.detail.avatarUrl }
          try { localStorage.setItem('pds-user', JSON.stringify(updated)) } catch {}
          return updated
        })
      }
    }
    window.addEventListener('pds:user-updated', handleUserUpdate)
    return () => window.removeEventListener('pds:user-updated', handleUserUpdate)
  }, [])

  const handleLogout = (reason = '') => {
    // Guard: if called directly as an onClick handler, reason will be a MouseEvent — ignore it
    const noticeMsg = typeof reason === 'string' ? reason : ''
    const refreshToken = localStorage.getItem('pds-refresh-token')
    if (refreshToken) {
      void api.logout(refreshToken).catch(() => {})
    }
    try {
      const currentUser = JSON.parse(localStorage.getItem('pds-user') || '{}') || {}
      if (currentUser?.id) localStorage.removeItem(`pds-ai-chat-${currentUser.id}`)
    } catch { /* best-effort */ }
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    localStorage.removeItem('pds-user')
    localStorage.removeItem('pds-last-activity')

    // Store session notice across the reload if one was provided
    if (noticeMsg) {
      try { sessionStorage.setItem('pds-session-notice', noticeMsg) } catch (err) { void err }
    }

    // Hard-navigate to root so Login always mounts fresh with no stale app shell
    window.location.replace('/')
  }

  // 5-minute session inactivity auto-logout — full per-second countdown from 5:00
const TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes total
const WARNING_MS = 60 * 1000       // show modal at 60 s remaining

useEffect(() => {
  if (!user) return

    const updateActivity = () => {
      localStorage.setItem('pds-last-activity', String(Date.now()))
    }

    // Set initial activity timestamp on mount / login
    updateActivity()
    setSessionSecondsLeft(TIMEOUT_MS / 1000) // start at 5:00

    let lastRecorded = Date.now()
    const handleUserActivity = () => {
      const now = Date.now()
      // Reset activity on deliberate actions (click, keypress, touch)
      if (now - lastRecorded > 2000) {
        lastRecorded = now
        updateActivity()
      }
    }

    const events = ['click', 'keydown', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }))

    // Tick every second — always track full countdown from 5:00 → 0:00
    const intervalId = setInterval(() => {
      const lastActivity = Number(localStorage.getItem('pds-last-activity') || Date.now())
      const elapsed    = Date.now() - lastActivity
      const remaining  = Math.max(0, TIMEOUT_MS - elapsed)
      const secs       = Math.ceil(remaining / 1000)

      setSessionSecondsLeft(secs) // always update — drives topbar pill + modal

      if (remaining <= 0) {
        handleLogout('You have been logged out due to 5 minutes of inactivity.')
      }
    }, 1000)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity))
      clearInterval(intervalId)
    }
  }, [user])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route: Certificate verification */}
        <Route path="/verify/certificate/:verificationCode" element={
          <Suspense fallback={<PageSkeleton />}>
            <CertificateVerification />
          </Suspense>
        } />

        {/* Public route: Register with invitation token */}
        <Route
          path="/register"
          element={
            <Suspense fallback={<PageSkeleton />}>
              {!user ? <Register /> : <Navigate to="/" replace />}
            </Suspense>
          }
        />

        {/* Main application or Login fallback */}
        <Route
          path="/*"
          element={
            !user ? (
              <Login
                onLogin={(u) => {
                  setSessionNotice('')
                  setUser(u)
                }}
                notice={sessionNotice}
              />
            ) : (
              <ErrorBoundary>
                <div className="min-h-screen flex text-gray-800 dark:text-gray-100">
                  <div className="flex-1 min-h-screen flex flex-col fixed-main">
                    <Header
                      key={`hdr-${user.id}`}
                      user={user}
                      onToggle={handleThemeToggle}
                      dark={dark}
                      onOpenMobileNav={() => setMobileNavOpen(true)}
                      onOpenAiChat={() => setAiChatOpen(true)}
                      sessionSecondsLeft={sessionSecondsLeft}
                      onResetSession={() => {
                        localStorage.setItem('pds-last-activity', String(Date.now()))
                        setSessionSecondsLeft(TIMEOUT_MS / 1000)
                      }}
                    />
                    <MobileNav user={user} onLogout={handleLogout} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
                    <ModuleRoutes user={user} />
                  </div>
                </div>

                {/* Session countdown warning — appears 60s before auto-logout */}
                {sessionSecondsLeft !== null && sessionSecondsLeft <= WARNING_MS / 1000 && (
                  <SessionWarning
                    secondsLeft={sessionSecondsLeft}
                    onStay={() => {
                      localStorage.setItem('pds-last-activity', String(Date.now()))
                      setSessionSecondsLeft(TIMEOUT_MS / 1000)
                    }}
                    onLogout={() => handleLogout('You chose to log out.')}
                  />
                )}
              </ErrorBoundary>
            )
          }
        />
      </Routes>

      {/* Global AI Chat Drawer — persists across all pages when authenticated */}
      {user && (
        <Suspense fallback={null}>
          <AIChatDrawer
            isOpen={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
            onOpen={() => setAiChatOpen(true)}
          />
        </Suspense>
      )}

      {/* Global Live Toast — polls for new notifications and surfaces them as toasts */}
      {user && <LiveToast />}
    </BrowserRouter>
  )
}

export default App
