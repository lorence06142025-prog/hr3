import React, { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { usePolling } from '../hooks/usePolling'

/**
 * LiveToast — Global real-time notification toaster.
 * Polls the notifications API every 30 s. When new unread notifications
 * arrive, it fires a subtle toast in the bottom-right corner.
 * Completely non-blocking and additive — does not interfere with any
 * existing component or business logic.
 */
export default function LiveToast() {
  const [toasts, setToasts] = useState([])
  const lastUnreadRef = useRef(null)
  const counterRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const poll = useCallback(async () => {
    try {
      const result = await api.notifications({ limit: 5 })
      const unread = result.unread || 0
      const items = result.notifications || []

      // On first poll, just capture the baseline — don't show a toast
      if (lastUnreadRef.current === null) {
        lastUnreadRef.current = unread
        return
      }

      // If unread count went up, find the new notifications and toast them
      if (unread > lastUnreadRef.current) {
        const newCount = unread - lastUnreadRef.current
        const newItems = items.filter(n => !n.is_read).slice(0, newCount)

        newItems.forEach(item => {
          const id = ++counterRef.current
          setToasts(prev => [
            ...prev.slice(-3), // keep max 4 toasts at once
            { id, title: item.title || 'New notification', body: item.message || '', time: Date.now() },
          ])
          // Auto-dismiss after 5 s
          setTimeout(() => dismiss(id), 5000)
        })

        // Emit event so dashboards silently re-fetch their KPIs
        window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      }

      lastUnreadRef.current = unread
    } catch {
      // Silent — never crash if polling fails
    }
  }, [dismiss])

  // Poll every 30 s
  usePolling(poll, 30000)

  // Initial poll on mount
  useEffect(() => { void poll() }, [poll])

  if (toasts.length === 0) return null

  return (
    <div className="live-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <div key={toast.id} className="live-toast" role="alert">
          <div className="live-toast-header">
            <span className="live-toast-pulse" />
            <span className="live-toast-label">New Activity</span>
            <button
              className="live-toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <p className="live-toast-title">{toast.title}</p>
          {toast.body && <p className="live-toast-body">{toast.body}</p>}
        </div>
      ))}
    </div>
  )
}
