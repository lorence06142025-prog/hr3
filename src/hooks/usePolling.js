import { useEffect, useRef, useCallback } from 'react'

/**
 * usePolling — Runs a callback on a fixed interval, silently, without
 * triggering loading spinners. Cleans up automatically on unmount.
 *
 * @param {Function} fn        - Async function to call on each tick
 * @param {number}   interval  - Polling interval in milliseconds
 * @param {boolean}  enabled   - Pause polling when false (e.g. tab hidden)
 */
export function usePolling(fn, interval = 45000, enabled = true) {
  const savedFn = useRef(fn)

  useEffect(() => {
    savedFn.current = fn
  }, [fn])

  useEffect(() => {
    if (!enabled) return
    const tick = () => { void savedFn.current() }
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [interval, enabled])
}
