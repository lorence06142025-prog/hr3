import { useEffect, useState, useRef } from 'react'

/**
 * AnimatedNumber smoothly counts from 0 (or previous value) to target value.
 * Handles numbers with suffixes/prefixes (e.g., "85%", "12/15", "5,888", "$2.6M", etc.)
 * Respects prefers-reduced-motion.
 */
export default function AnimatedNumber({ value, duration = 600, className = '' }) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(0)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setDisplayValue(value)
      return
    }

    // Extract numeric portion and any prefix/suffix
    const strVal = String(value ?? 0)
    const match = strVal.match(/^([^0-9.-]*)([0-9,.]+)([^0-9]*)$/)

    if (!match) {
      setDisplayValue(value)
      return
    }

    const prefix = match[1] || ''
    const numPart = parseFloat(match[2].replace(/,/g, ''))
    const suffix = match[3] || ''

    if (isNaN(numPart)) {
      setDisplayValue(value)
      return
    }

    const startNum = isFirstRender.current ? 0 : (prevValueRef.current || 0)
    const endNum = numPart
    prevValueRef.current = endNum
    isFirstRender.current = false

    if (startNum === endNum) {
      setDisplayValue(value)
      return
    }

    const startTime = performance.now()
    let animFrameId

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Standard ease-out-cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const current = startNum + (endNum - startNum) * easeProgress

      const isInteger = Number.isInteger(numPart)
      const formattedNum = isInteger ? Math.round(current) : current.toFixed(1)
      
      setDisplayValue(`${prefix}${formattedNum}${suffix}`)

      if (progress < 1) {
        animFrameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    animFrameId = requestAnimationFrame(step)

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId)
    }
  }, [value, duration])

  return <span className={className}>{displayValue}</span>
}
