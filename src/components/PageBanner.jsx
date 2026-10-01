import React from 'react'

export default function PageBanner({
  title,
  subtitle,
  description,
  badge,
  icon,
  actions,
  className = '',
}) {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}')
    } catch {
      return {}
    }
  })()

  const role = user.role || 'hr'
  const firstName = (user.name || 'User').split(' ')[0]
  const displayBadge = badge || (role ? role.replace(/_/g, ' ').toUpperCase() : 'CONSOLE')

  const subText = subtitle || (
    description
      ? `Welcome back, ${firstName}. ${description}`
      : `Welcome back, ${firstName}. Workforce operations & system management.`
  )

  return (
    <section className={`exec-console-banner ${className}`.trim()}>
      <div className="exec-banner-left">
        {icon && (
          <div className="exec-banner-icon">
            {icon}
          </div>
        )}
        <div className="exec-banner-text">
          <div className="exec-banner-title-row">
            <h1 className="exec-banner-title">{title}</h1>
            <span className="exec-banner-badge">{displayBadge}</span>
          </div>
          <p className="exec-banner-sub">{subText}</p>
        </div>
      </div>

      {actions && (
        <div className="exec-banner-actions">
          {actions}
        </div>
      )}

      {/* Ambient background decoration */}
      <svg
        className="exec-banner-graphic"
        width="340"
        height="120"
        viewBox="0 0 340 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="280" cy="60" r="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <circle cx="280" cy="60" r="60" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx="280" cy="60" r="20" fill="rgba(255,255,255,0.06)" />
      </svg>
    </section>
  )
}
