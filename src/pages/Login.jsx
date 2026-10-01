import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import LoginIllustration from '../components/LoginIllustration'
import { Key, Eye, EyeOff, Tag, AlertTriangle, CheckCircle, CheckCircle2, DoorOpen, Clock, Lock, Info, Building2, Mail, Check, ArrowRight, ShieldCheck, RotateCcw, Smartphone } from 'lucide-react'

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Session notice from sessionStorage
  const [sessionNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('pds-session-notice') || ''
      if (msg) sessionStorage.removeItem('pds-session-notice')
      return msg
    } catch {
      return ''
    }
  })

  const displayNotice = sessionNotice || notice || ''

  // Dark / Light Theme state
  const [isDark, setIsDark] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('pds-theme') === 'dark'
    } catch {
      return false
    }
  })

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    const root = document.documentElement
    if (nextDark) {
      root.classList.add('dark')
      try { localStorage.setItem('pds-theme', 'dark') } catch (err) { void err }
    } else {
      root.classList.remove('dark')
      try { localStorage.setItem('pds-theme', 'light') } catch (err) { void err }
    }
  }

  // Mode: 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login')

  // 5-Second Password Peek State
  const [showPassword, setShowPassword] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef(null)

  // Reset Password State
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showResetPass, setShowResetPass] = useState(false)
  const [resetSecondsLeft, setResetSecondsLeft] = useState(0)
  const resetTimerRef = useRef(null)

  // Lockout State
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const lockoutTimerRef = useRef(null)

  // 2FA State
  const [is2FA, setIs2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  // OTP digit boxes (6 individual inputs)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef([])
  const [rememberDevice, setRememberDevice] = useState(false)

  // Login Success State (Triggers Cinematic Entrance Transition)
  const [isLoggingInSuccess, setIsLoggingInSuccess] = useState(false)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (resetTimerRef.current) clearInterval(resetTimerRef.current)
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [])

  // Auto-focus first OTP digit when 2FA mode activates
  useEffect(() => {
    if (is2FA) {
      const timer = setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [is2FA])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      lockoutTimerRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(lockoutTimerRef.current)
            setError('')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [lockoutSeconds > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5-second password peek handler for Login
  const handleToggleShowPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (showPassword) {
      if (timerRef.current) clearInterval(timerRef.current)
      setShowPassword(false)
      setSecondsLeft(0)
      return
    }

    if (timerRef.current) clearInterval(timerRef.current)
    setShowPassword(true)
    setSecondsLeft(5)

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setShowPassword(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // 5-second password peek handler for Reset
  const handleToggleShowResetPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (showResetPass) {
      if (resetTimerRef.current) clearInterval(resetTimerRef.current)
      setShowResetPass(false)
      setResetSecondsLeft(0)
      return
    }

    if (resetTimerRef.current) clearInterval(resetTimerRef.current)
    setShowResetPass(true)
    setResetSecondsLeft(5)

    resetTimerRef.current = setInterval(() => {
      setResetSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(resetTimerRef.current)
          setShowResetPass(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (lockoutSeconds > 0 || isLoggingInSuccess) return

    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await api.login(email, password)
      if (result.require2FA) {
        setIs2FA(true)
        setTempToken(result.tempToken)
        setTwoFactorCode('')
        return
      }

      localStorage.setItem('pds-token', result.token)
      if (result.refreshToken) localStorage.setItem('pds-refresh-token', result.refreshToken)
      localStorage.setItem('pds-user', JSON.stringify(result.user))

      // Trigger cinematic partition reveal animation (snappy 0.85s transition)
      setIsLoggingInSuccess(true)
      setTimeout(() => {
        onLogin(result.user)
      }, 850)
    } catch (requestError) {
      const errMsg = requestError.message || ''
      setError(errMsg)

      if (errMsg.toLowerCase().includes('locked') || errMsg.toLowerCase().includes('seconds')) {
        const match = errMsg.match(/(\d+)\s*second/i)
        const secs = match ? parseInt(match[1], 10) : 60
        setLockoutSeconds(secs)
      }
    } finally {
      setLoading(false)
    }
  }

  const submit2FA = async (event) => {
    event.preventDefault()
    const code = otpDigits.join('')
    if (code.length < 6 || isLoggingInSuccess) {
      setError('Please enter your 6-digit Google Authenticator code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await api.verify2FA(tempToken, code)
      localStorage.setItem('pds-token', result.token)
      if (result.refreshToken) localStorage.setItem('pds-refresh-token', result.refreshToken)
      localStorage.setItem('pds-user', JSON.stringify(result.user))

      // Trigger cinematic partition reveal animation (snappy 0.85s transition)
      setIsLoggingInSuccess(true)
      setTimeout(() => {
        onLogin(result.user)
      }, 850)
    } catch (requestError) {
      setError(requestError.message)
      // Clear digits on wrong code
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => { otpRefs.current[0]?.focus() }, 50)
    } finally {
      setLoading(false)
    }
  }

  const cancel2FA = () => {
    setIs2FA(false)
    setTempToken('')
    setTwoFactorCode('')
    setOtpDigits(['', '', '', '', '', ''])
    setRememberDevice(false)
    setError('')
  }

  // Handle single OTP digit input with auto-advance
  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    // Update the combined twoFactorCode for compatibility
    setTwoFactorCode(next.join(''))
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  // Handle backspace to move to previous box
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus()
  }

  // Paste support — fill all 6 boxes from clipboard
  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setOtpDigits(next)
    setTwoFactorCode(next.join(''))
    const focusIdx = Math.min(pasted.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your registered enterprise email address.')
      return
    }
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await api.forgotPassword(email)
      setSuccessMsg(res.message || 'Password reset link has been prepared.')
      if (res.resetToken) setResetToken(res.resetToken)
      setMode('reset')
    } catch (err) {
      setError(err.message || 'Unable to process password reset.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetToken.trim()) {
      setError('Please provide a valid password reset token.')
      return
    }
    if (!newPassword) {
      setError('Please enter a new password.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.resetPassword(resetToken.trim(), newPassword)
      setSuccessMsg('Your password has been successfully reset! You can now sign in.')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setResetToken('')
      setMode('login')
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`login-split-page ref-theme-page ${isLoggingInSuccess ? 'page-logging-in-success' : ''}`}>
      {/* Quick Theme Switcher Button */}
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span>Light</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>Dark</span>
          </>
        )}
      </button>

      {/* LEFT SIDE: Centered Showcase with logistics brand circles & full photo lightbox */}
      <section className="login-illustration-column" aria-label="Priority Handling Services, Inc.">
        <LoginIllustration isLoggingInSuccess={isLoggingInSuccess} />
      </section>

      {/* RIGHT SIDE: Clean Modern Executive Form */}
      <section className="login-form-column" aria-label="Sign In to Priority Handling Services, Inc.">
        <div className="login-card-container">
          {/* ================================================================ */}
          {/* 1. TWO-FACTOR AUTHENTICATION VIEW                                */}
          {/* ================================================================ */}
          {is2FA ? (
            <form className="login-card ref-card tfa-card" onSubmit={submit2FA}>
              <div className="ref-card-inner">
                {/* ── Close button ── */}
                <button
                  type="button"
                  className="tfa-close-btn"
                  onClick={cancel2FA}
                  disabled={loading || isLoggingInSuccess}
                  aria-label="Back to sign in"
                >
                  ✕
                </button>

                {/* ── Lock Icon with blue check badge & halo ── */}
                <div className="tfa-icon-wrap">
                  <div className="tfa-icon-halo" aria-hidden="true" />
                  <div className="tfa-icon-shield">
                    <Lock size={24} color="#ffffff" strokeWidth={2.2} />
                  </div>
                  <div className="tfa-icon-badge">
                    <Check size={11} color="#ffffff" strokeWidth={3} />
                  </div>
                </div>

                {/* ── Title & description ── */}
                <h1 className="tfa-title">Two-Factor Authentication</h1>
                <p className="tfa-desc">
                  Enter the 6-digit code from your authenticator app<br />
                  to continue to Priority Handling Services, Inc.
                </p>

                {/* ── Error banner ── */}
                {error && (
                  <div className="login-error" style={{ marginBottom: 14 }}>
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {/* ── 6 Individual OTP Digit Boxes ── */}
                <div className={`tfa-otp-row ${error ? 'has-error' : ''}`}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`tfa-otp-box ${digit ? 'tfa-otp-box--filled' : ''}`}
                      value={digit}
                      autoFocus={i === 0}
                      onChange={e => handleOtpDigit(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      disabled={loading || isLoggingInSuccess}
                      autoComplete="one-time-code"
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>

                {/* ── Hint text with phone icon ── */}
                <div className="tfa-hint">
                  <Smartphone size={14} className="tfa-hint-icon" />
                  <span>Open your authenticator app (e.g. Google Authenticator, Authy, or Microsoft Authenticator) and enter the code.</span>
                </div>

                {/* ── Remember device checkbox ── */}
                <label className="tfa-remember">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={e => setRememberDevice(e.target.checked)}
                    disabled={loading || isLoggingInSuccess}
                    className="tfa-remember-checkbox"
                  />
                  <span>Remember this device for 30 days</span>
                  <span className="tfa-remember-info" title="You won't be asked for a code on this device for 30 days">
                    <Info size={13} />
                  </span>
                </label>

                {/* ── Submit button (auto-submits when 6 digits filled) ── */}
                <button
                  type="submit"
                  className={`ref-action-btn tfa-submit-btn ${isLoggingInSuccess ? 'btn-success-active' : ''}`}
                  disabled={loading || otpDigits.join('').length < 6 || isLoggingInSuccess}
                  style={{ marginTop: 18 }}
                >
                  {isLoggingInSuccess ? (
                    <>
                      <Check size={16} />
                      <span>Access Granted…</span>
                    </>
                  ) : (
                    <>
                      <span>{loading ? 'Verifying…' : 'Verify & Sign In'}</span>
                      <span className="ref-action-btn-circle" aria-hidden="true">
                        <ArrowRight size={16} strokeWidth={2} />
                      </span>
                    </>
                  )}
                </button>

                {/* ── Having trouble divider ── */}
                <div className="tfa-trouble-divider">
                  <span>Having trouble?</span>
                </div>

                {/* ── Recovery code button ── */}
                <button
                  type="button"
                  className="tfa-recovery-btn"
                  onClick={cancel2FA}
                  disabled={loading || isLoggingInSuccess}
                >
                  <RotateCcw size={15} />
                  <span>Use a recovery code instead</span>
                </button>
              </div>
            </form>
          ) : mode === 'forgot' ? (
            /* ================================================================ */
            /* 2. FORGOT PASSWORD VIEW                                          */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={handleForgotPassword}>
              <div className="ref-card-inner">
                <div className="login-card-header">
                  <h1 className="ref-form-title">Reset your password</h1>
                  <p className="ref-form-sub">Enter your registered email to receive password reset instructions.</p>
                </div>

                {error && (
                  <div className="login-error">
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="login-notice">
                    <CheckCircle size={15} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="ref-field-group">
                  <label className="ref-label">Email</label>
                  <div className="ref-input-wrap">
                    <Mail className="ref-input-icon" size={16} />
                    <input
                      type="email"
                      className="ref-input-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="ref-action-btn" disabled={loading}>
                  <span>{loading ? 'Sending…' : 'Send Instructions'}</span>
                  <span className="ref-action-btn-circle" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </button>

                <button
                  type="button"
                  className="ref-secondary-btn"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                  disabled={loading}
                >
                  ← Back to Sign In
                </button>

                <div className="login-security-badge">
                  <ShieldCheck size={14} />
                  <span>Protected by Priority Handling Services, Inc. role-based security</span>
                </div>
              </div>
            </form>
          ) : mode === 'reset' ? (
            /* ================================================================ */
            /* 3. RESET PASSWORD VIEW                                          */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={handleResetPassword}>
              <div className="ref-card-inner">
                <div className="login-card-header">
                  <h1 className="ref-form-title">Set new password</h1>
                  <p className="ref-form-sub">Create a secure password for your executive account.</p>
                </div>

                {error && (
                  <div className="login-error">
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="login-notice">
                    <Info size={15} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="ref-field-group">
                  <label className="ref-label">Reset Verification Token</label>
                  <div className="ref-input-wrap">
                    <Tag className="ref-input-icon" size={16} />
                    <input
                      type="text"
                      className="ref-input-control"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste reset token here"
                      required
                    />
                  </div>
                </div>

                <div className="ref-field-group">
                  <label className="ref-label">New Password</label>
                  <div className="ref-input-wrap">
                    <Lock className="ref-input-icon" size={16} />
                    <input
                      type={showResetPass ? 'text' : 'password'}
                      className="ref-input-control"
                      style={{ paddingRight: 46 }}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      required
                    />
                    <button
                      type="button"
                      className="ref-peek-btn"
                      onClick={handleToggleShowResetPassword}
                      title={showResetPass ? `Visible for ${resetSecondsLeft}s` : 'Show password for 5 seconds'}
                      tabIndex={0}
                      aria-label={showResetPass ? 'Hide password' : 'Show password'}
                    >
                      {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="ref-field-group">
                  <label className="ref-label">Confirm Password</label>
                  <div className="ref-input-wrap">
                    <Lock className="ref-input-icon" size={16} />
                    <input
                      type={showResetPass ? 'text' : 'password'}
                      className="ref-input-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="ref-action-btn" disabled={loading}>
                  <span>{loading ? 'Updating…' : 'Update & Sign In'}</span>
                  <span className="ref-action-btn-circle" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </button>

                <button
                  type="button"
                  className="ref-secondary-btn"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                  disabled={loading}
                >
                  ← Back to Sign In
                </button>

                <div className="login-security-badge">
                  <ShieldCheck size={14} />
                  <span>Protected by Priority Handling Services, Inc. role-based security</span>
                </div>
              </div>
            </form>
          ) : (
            /* ================================================================ */
            /* 4. STANDARD LOGIN VIEW (Matches Reference Screenshot 1)          */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={submit}>
              <div className="ref-card-inner">
                {/* Header */}
                <div className="login-card-header">
                  <h2 className="ref-form-title">Welcome back</h2>
                  <p className="ref-form-sub">Enter your credentials to access the system.</p>
                </div>

                {/* Notice Banners */}
                {displayNotice && !error && !successMsg && (
                  <div className="login-notice">
                    <Clock size={15} />
                    <span>{displayNotice}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="login-notice">
                    <CheckCircle size={15} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {lockoutSeconds > 0 && (
                  <div className="login-lockout-banner">
                    <Lock size={18} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Account temporarily locked.</div>
                      <div style={{ fontSize: 11.5, marginTop: 2 }}>
                        Please wait <strong>{lockoutSeconds}s</strong> before trying again.
                      </div>
                    </div>
                  </div>
                )}

                {error && lockoutSeconds === 0 && (
                  <div className="login-error">
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {/* 1. Email Input Field */}
                <div className="ref-field-group">
                  <label className="ref-label">Email</label>
                  <div className="ref-input-wrap">
                    <Mail className="ref-input-icon" size={16} />
                    <input
                      type="email"
                      className="ref-input-control"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={loading || isLoggingInSuccess}
                    />
                  </div>
                </div>

                {/* 2. Password Input Field */}
                <div className="ref-field-group">
                  <div className="ref-label-row">
                    <label className="ref-label">Password</label>
                    <button
                      type="button"
                      className="ref-forgot-link"
                      onClick={() => { setMode('forgot'); setError(''); setSuccessMsg('') }}
                      disabled={isLoggingInSuccess}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="ref-input-wrap">
                    <Lock className="ref-input-icon" size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="ref-input-control"
                      style={{ paddingRight: 46 }}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      disabled={loading || isLoggingInSuccess}
                    />
                    {/* Password Peek Toggle */}
                    <button
                      type="button"
                      className="ref-peek-btn"
                      onClick={handleToggleShowPassword}
                      title={showPassword ? `Visible for ${secondsLeft}s (auto-hides)` : 'Show password for 5 seconds'}
                      tabIndex={0}
                      disabled={isLoggingInSuccess}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* 3. Login Action Button */}
                <button
                  type="submit"
                  className={`ref-action-btn ${isLoggingInSuccess ? 'btn-success-active' : ''}`}
                  disabled={loading || lockoutSeconds > 0 || isLoggingInSuccess}
                >
                  {isLoggingInSuccess ? (
                    <>
                      <Check size={16} />
                      <span>Access Granted…</span>
                    </>
                  ) : (
                    <>
                      <span>{loading ? 'Signing in…' : lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Sign in'}</span>
                      <span className="ref-action-btn-circle" aria-hidden="true">
                        <ArrowRight size={16} strokeWidth={2} />
                      </span>
                    </>
                  )}
                </button>

                {/* 4. Protected by role-based security footnote */}
                <div className="login-security-badge">
                  <ShieldCheck size={14} />
                  <span>Protected by Priority Handling Services, Inc. role-based security</span>
                </div>
              </div>
            </form>
          )}

          {/* Copyright Notice */}
          <div className="login-copyright-note">
            © {new Date().getFullYear()} Priority Handling Services, Inc. All rights reserved.
          </div>
        </div>
      </section>

      {/* ── CINEMATIC PARTITION REVEAL OVERLAY (LOGISTICS PHOTO + TRANSLUCENT ACCEPTED BOX) ── */}
      {isLoggingInSuccess && (
        <div className="login-success-portal-curtain" aria-live="assertive">
          <div className="login-success-zoom-stage">
            <img
              src="/prioritylogo.png"
              alt="Priority Handling Services company logo"
              className="login-success-hero-img"
              style={{ width: 72, height: 72, objectFit: 'contain' }}
            />
            <div className="login-success-light-sweep" />
            <div className="login-success-lens-flare" />
          </div>
          <div className="login-success-hud-center">
            <div className="login-success-hud-card">
              <div className="login-success-icon-badge">
                <CheckCircle2 size={34} color="#34d399" />
              </div>
              <div className="login-success-title">AUTHENTICATION ACCEPTED</div>
              <div className="login-success-company-name">PRIORITY HANDLING SERVICES, INC.</div>
              <div className="login-success-sub-text">
                <DoorOpen size={16} className="text-emerald-500" />
                <span>Authentication accepted, logging in...</span>
              </div>
              <div className="login-success-progress-track">
                <div className="login-success-progress-fill" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
