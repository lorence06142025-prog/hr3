import { useEffect, useRef } from 'react'

/**
 * useDialogFocus — keyboard-accessible modal dialog management.
 *
 * Features:
 *  - Focus trap: Tab/Shift+Tab cycle is confined to the dialog content.
 *  - Escape-to-close: pressing Escape invokes onClose (and refocuses opener).
 *  - Focus restore: on open, focuses the first input or focusable element; on close,
 *    returns focus to the element that opened the dialog.
 *  - Background scroll lock while open.
 */
export default function useDialogFocus(open, onClose, { focusFirstOnOpen = true } = {}) {
  const containerRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const container = containerRef.current
    if (!container) return undefined

    // Remember what had focus before the dialog opened.
    previouslyFocusedRef.current = document.activeElement

    // Focus the first input/textarea or first focusable element inside the dialog.
    if (focusFirstOnOpen) {
      const focusable = Array.from(
        container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      // Prefer focusing the first input/textarea over a close button
      const target = focusable.find(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') || focusable[0]
      if (target) {
        target.focus()
      } else {
        container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    // Lock background scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      // Escape closes the dialog.
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }

      // Tab focus trap.
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      if (!focusable.length) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last.
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        // Tab: if on last element, wrap to first.
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      // Restore focus to the opener once closed.
      const previouslyFocused = previouslyFocusedRef.current
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open, focusFirstOnOpen])

  return containerRef
}
