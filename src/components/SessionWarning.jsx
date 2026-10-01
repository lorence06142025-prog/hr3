import React, { useEffect, useState, useRef } from 'react'

/**
 * SessionWarning
 * Shows a modal with a live per-second countdown when the session is about
 * to expire. Gives the user the option to stay logged in or logout now.
 *
 * Props:
 *   secondsLeft  — current seconds remaining (integer, passed from App.jsx)
 *   onStay       — called when user clicks "Stay logged in"
 *   onLogout     — called when user clicks "Logout now"
 */
export default function SessionWarning({ secondsLeft, onStay, onLogout }) {
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeLabel = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`

  // Progress ring — shrinks as time runs out
  const WARN_SECONDS = 60 // same as WARNING_THRESHOLD_MS / 1000 in App.jsx
  const progress = Math.max(0, secondsLeft / WARN_SECONDS) // 1 → 0
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const urgent = secondsLeft <= 15

  return (
    <div className="sw-overlay" role="dialog" aria-modal="true" aria-label="Session expiring soon">
      <div className={`sw-modal${urgent ? ' sw-urgent' : ''}`}>
        {/* Countdown ring */}
        <div className="sw-ring-wrap">
          <svg width="72" height="72" viewBox="0 0 72 72">
            {/* Track */}
            <circle
              cx="36" cy="36" r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="6"
            />
            {/* Progress arc */}
            <circle
              cx="36" cy="36" r={radius}
              fill="none"
              stroke={urgent ? '#ef4444' : '#f59e0b'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.4s ease' }}
            />
          </svg>
          <span className={`sw-ring-label${urgent ? ' sw-ring-urgent' : ''}`}>
            {timeLabel}
          </span>
        </div>

        <div className="sw-text">
          <h3 className="sw-title">Session expiring soon</h3>
          <p className="sw-desc">
            You've been inactive. Your session will automatically end in{' '}
            <strong>{timeLabel}</strong>. Do you want to stay logged in?
          </p>
        </div>

        <div className="sw-actions">
          <button className="sw-btn-stay" onClick={onStay}>
            Stay logged in
          </button>
          <button className="sw-btn-logout" onClick={onLogout}>
            Logout now
          </button>
        </div>
      </div>
    </div>
  )
}
