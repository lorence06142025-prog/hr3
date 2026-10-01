import React, { useEffect, useRef, useState } from 'react'
import { TrendingUp, Users, Award } from 'lucide-react'

// Route coordinates matching FleetOps milestone layout
const PATH_PRIMARY = "M 14 196 C 84 204, 96 96, 186 96 C 276 96, 264 198, 356 196 C 408 195, 446 152, 460 88"
const PATH_SUB = "M 24 140 C 96 150, 150 214, 228 208 C 316 201, 350 70, 452 44"

export default function LoginIllustration({ isLoggingInSuccess = false }) {
  const pathRef = useRef(null)
  const [pos, setPos] = useState({ x: 14, y: 196 })

  useEffect(() => {
    let animId
    let startTime = null
    const duration = 7000 // 7 seconds smooth looping transit

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime

      if (pathRef.current) {
        const pathLen = pathRef.current.getTotalLength()
        const progress = (elapsed % duration) / duration
        const point = pathRef.current.getPointAtLength(progress * pathLen)
        setPos({ x: point.x, y: point.y })
      }

      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div
      className={`login-hero-stage ${isLoggingInSuccess ? 'login-transition-active' : ''}`}
      aria-label="PerDevSys Executive Platform"
    >
      {/* Top Brand Header */}
      <div className="login-hero-brand">
        <div className="login-hero-logo-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="6" fill="#111827" />
            <path d="M7 8h10M7 12h10M7 16h6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="login-hero-brand-text">
          <span className="login-hero-brand-name">PerDevSys</span>
          <span className="login-hero-brand-sub">Hospitality HR Management</span>
        </div>
      </div>

      {/* Main Bold Headline */}
      <div className="login-hero-content">
        <h1 className="login-hero-title">
          <span>Operate your workforce</span>
          <span className="login-hero-title-muted">with total clarity.</span>
        </h1>
        <p className="login-hero-lead">
          Coordinate performance, competencies, and talent development, from onboarding to succession, in one intelligent command center.
        </p>
      </div>

      {/* Milestone Curve Vector Graphic with Animated Traveling Circle */}
      <div className="login-hero-curve-wrap" aria-hidden="true">
        <svg viewBox="0 0 480 260" className="login-hero-curve-svg" fill="none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="route-primary-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="route-sub-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Sub curve */}
          <path
            d={PATH_SUB}
            stroke="url(#route-sub-grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 8"
          />

          {/* Primary wave line */}
          <path
            ref={pathRef}
            d={PATH_PRIMARY}
            stroke="url(#route-primary-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Start node at (14, 196) */}
          <circle cx="14" cy="196" r="5" fill="currentColor" />
          {/* Pulsing ripple at start node */}
          <circle cx="14" cy="196" r="5" fill="none" stroke="currentColor" strokeOpacity="0.4" className="login-curve-ripple" />

          {/* Milestone nodes at (186, 96) and (356, 196) */}
          <circle cx="186" cy="96" r="4.5" fill="var(--bg-card, #ffffff)" stroke="currentColor" strokeWidth="2" />
          <circle cx="356" cy="196" r="4.5" fill="var(--bg-card, #ffffff)" stroke="currentColor" strokeWidth="2" />

          {/* Right-side milestone target node at (460, 88) */}
          <g>
            <circle cx="460" cy="88" r="10" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" className="login-curve-target-pulse" />
            <circle cx="460" cy="88" r="5" fill="currentColor" />
          </g>

          {/* Moving Circle along the path! */}
          <g transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="12" fill="var(--bg-card, #ffffff)" stroke="currentColor" strokeWidth="2" />
            <g transform="translate(-7, -7)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </g>
          </g>
        </svg>
      </div>

      {/* Feature Pills */}
      <div className="login-hero-badges">
        <div className="login-hero-pill">
          <TrendingUp size={13} />
          <span>Real-time Workforce Analytics</span>
        </div>
        <div className="login-hero-pill">
          <Users size={13} />
          <span>Enterprise RBAC</span>
        </div>
        <div className="login-hero-pill">
          <Award size={13} />
          <span>Verified Certifications</span>
        </div>
      </div>
    </div>
  )
}
