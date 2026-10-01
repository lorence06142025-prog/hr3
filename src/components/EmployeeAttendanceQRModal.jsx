import React, { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import QRCodeImage from './QRCodeImage'
import { api } from '../lib/api'
import {
  X, Camera, QrCode, CheckCircle2, AlertCircle,
  RefreshCw, Volume2, VolumeX
} from 'lucide-react'

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

/**
 * EmployeeAttendanceQRModal
 *
 * - Tab 1 (My Digital Badge): Employee shows their personal QR code to an
 *   authorized trainer/HR who will scan it on THEIR device.
 *
 * - Tab 2 (Scan Session QR): Employee uses THEIR camera to scan the
 *   session QR code displayed on the projector/door to self-check-in.
 *   This tab DOES NOT scan other employees' badges — that is restricted
 *   to authorized personnel (HR / Supervisor / Ops Manager).
 */
export default function EmployeeAttendanceQRModal({ user, onClose, onAttendanceUpdated, activeSessions = [] }) {
  const [activeTab, setActiveTab] = useState('my_badge')
  const [cameraActive, setCameraActive] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [soundEnabled, setSoundEnabled] = useState(true)

  const [scanningStatus, setScanningStatus] = useState('idle') // idle | processing | success | error
  const [statusMessage, setStatusMessage] = useState('')
  const [successData, setSuccessData] = useState(null) // shown as full confirmation card

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameId = useRef(null)
  const isProcessingRef = useRef(false)
  const lastScannedCodeRef = useRef('')
  const lastScannedTimeRef = useRef(0)

  // ── Personal badge QR payload (shown to HR / Trainer to scan)
  const badgePayload = JSON.stringify({
    type: 'pds_employee_badge',
    employeeId: user.employeeId || user.id,
    employeeNumber: user.employeeNumber || user.employee_number || 'E001',
    name: user.name || user.full_name,
    role: user.role,
  })

  // ── Handle scanning a SESSION QR code (self-checkin only)
  const handleProcessScan = useCallback(async (scannedData) => {
    if (!scannedData) return
    const now = Date.now()
    if (scannedData === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 2500) return
    lastScannedCodeRef.current = scannedData
    lastScannedTimeRef.current = now

    isProcessingRef.current = true
    setScanningStatus('processing')
    setStatusMessage('Reading QR code...')

    try {
      // ── Detect session QR (URL or JSON)
      let parsedSessionId = null

      if (scannedData.includes('checkin=')) {
        const match = scannedData.match(/checkin=([a-zA-Z0-9_-]+)/)
        if (match && match[1]) parsedSessionId = match[1]
      }

      if (!parsedSessionId) {
        try {
          const parsed = JSON.parse(scannedData)
          if (parsed.type === 'pds_training_session' || parsed.sessionId) {
            parsedSessionId = parsed.sessionId || parsed.id
          }
        } catch {}
      }

      // ── If it's an employee badge QR (not a session QR), reject it
      if (!parsedSessionId) {
        let isBadge = false
        try {
          const parsed = JSON.parse(scannedData)
          if (parsed.type === 'pds_employee_badge' || parsed.employeeNumber || parsed.employeeId) {
            isBadge = true
          }
        } catch {}
        setScanningStatus('error')
        setStatusMessage(isBadge
          ? 'That is an Employee Badge QR. Only authorized trainers can scan employee badges. Please scan the session QR code displayed by your trainer.'
          : 'Unrecognized QR code. Please scan the training session QR code shown in the training room.')
        isProcessingRef.current = false
        return
      }

      // ── Self-checkin
      const res = await api.selfCheckinTrainingSession(parsedSessionId, {
        employeeId: user.employeeId || user.id,
      })

      if (res.success) {
        if (soundEnabled) playSuccessChime()
        setScanningStatus('success')
        setStatusMessage('Attendance recorded!')
        setSuccessData({
          sessionTitle: res.session?.title || 'Training Session',
          venue: res.session?.venue || '',
          startDate: res.session?.start_date ? String(res.session.start_date).slice(0, 10) : '',
          employeeName: user.name || user.full_name,
          employeeNumber: user.employeeNumber || user.employee_number || 'E001',
          time: new Date().toLocaleTimeString(),
        })
        if (onAttendanceUpdated) onAttendanceUpdated()
      }
    } catch (err) {
      setScanningStatus('error')
      setStatusMessage(err.message || 'Check-in failed. Please try again.')
      isProcessingRef.current = false
    }
  }, [user, soundEnabled, onAttendanceUpdated])

  // ── Camera loop
  useEffect(() => {
    if (activeTab !== 'scan_session' || !cameraActive || successData) {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
      return
    }

    let active = true
    let streamInstance = null

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } },
    })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamInstance = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.play().catch(() => {})
        }
        setCameraError('')
      })
      .catch(() => setCameraError('Camera access denied or unavailable.'))

    const tick = () => {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !isProcessingRef.current) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (result?.data) handleProcessScan(result.data)
      }
      animFrameId.current = requestAnimationFrame(tick)
    }
    animFrameId.current = requestAnimationFrame(tick)

    return () => {
      active = false
      streamInstance?.getTracks().forEach(t => t.stop())
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
    }
  }, [activeTab, cameraActive, facingMode, handleProcessScan, successData])

  const initials = (user.name || 'EM').match(/\b\w/g)?.slice(0, 2).join('').toUpperCase() || 'EM'

  return (
    <div className="training-modal-overlay" role="dialog" aria-modal="true">
      <div className="training-modal-content qr-attendance-modal" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="training-modal-header" style={{ padding: '16px 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="session-category-tag" style={{ margin: 0 }}>TRAINING ATTENDANCE</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Attendance &amp; Check-In</h3>
            <small style={{ color: '#64748b' }}>
              ID: <b>{user.employeeNumber || user.employee_number || 'E001'}</b> · {user.name}
            </small>
          </div>
          <button className="training-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="qr-tabs-nav">
          <button
            className={'qr-tab-btn ' + (activeTab === 'my_badge' ? 'active' : '')}
            onClick={() => { setActiveTab('my_badge'); setSuccessData(null); setScanningStatus('idle') }}
          >
            <QrCode size={14} /> My Badge QR
          </button>
          <button
            className={'qr-tab-btn ' + (activeTab === 'scan_session' ? 'active' : '')}
            onClick={() => setActiveTab('scan_session')}
          >
            <Camera size={14} /> Scan Session QR
          </button>
        </div>

        {/* ── TAB 1: PERSONAL BADGE (show to trainer to scan) */}
        {activeTab === 'my_badge' && (
          <div style={{ padding: '20px 16px' }}>
            <div className="qr-session-display-card" style={{ maxWidth: 440, padding: 20, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span className="avatar avatar-lia" style={{ width: 44, height: 44, fontSize: 15, fontWeight: 800 }}>{initials}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ display: 'block', fontSize: 16, color: '#1e1b4b' }}>{user.name}</b>
                  <small style={{ color: '#111827', fontWeight: 700, fontSize: 12 }}>
                    ID: {user.employeeNumber || user.employee_number || 'E001'} · {(user.role || '').toUpperCase()}
                  </small>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  ACTIVE
                </span>
              </div>

              <div className="qr-code-large-box" style={{ margin: '0 auto 12px', padding: 16 }}>
                <QRCodeImage value={badgePayload} size={200} />
                <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Employee Badge QR
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>
                <b style={{ color: '#1d4ed8' }}>How this works:</b>
                <p style={{ margin: '4px 0 0', color: '#1e40af' }}>
                  Show this QR code to your <strong>HR trainer or supervisor</strong>. They will scan it with their device to mark your attendance as <strong>PRESENT</strong>.
                </p>
              </div>

              <button
                type="button"
                style={{ marginTop: 14, width: '100%', background: 'rgba(17, 24, 39, 0.08)', color: '#111827', border: '1px solid rgba(17, 24, 39, 0.25)', padding: '9px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => setActiveTab('scan_session')}
              >
                <Camera size={14} /> Or scan the training room session QR →
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: SCAN SESSION QR (employee self-checkin only) */}
        {activeTab === 'scan_session' && (
          <div style={{ padding: '16px 20px' }}>

            {/* SUCCESS CARD */}
            {successData ? (
              <div style={{
                background: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: 16,
                padding: '28px 20px',
                textAlign: 'center',
                boxShadow: '0 8px 30px rgba(16,185,129,0.18)',
              }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 size={42} strokeWidth={2} />
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#15803d' }}>
                  Your Attendance is Recorded!
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: '#334155' }}>
                  You are marked as{' '}
                  <strong style={{ background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: 20, fontWeight: 800 }}>
                    ✓ PRESENT
                  </strong>
                </p>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #d1fae5',
                  borderRadius: 10,
                  padding: '14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px 8px',
                  textAlign: 'left',
                  fontSize: 12.5,
                  marginBottom: 20,
                }}>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Session</small>
                    <b style={{ color: '#1e1b4b' }}>{successData.sessionTitle}</b>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Venue</small>
                    <span>{successData.venue || '—'}</span>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Employee</small>
                    <b>{successData.employeeName}</b>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Recorded At</small>
                    <span>{successData.time}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    style={{ padding: '9px 24px', fontSize: 14, fontWeight: 700, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}
                    onClick={onClose}
                  >
                    ✓ Done
                  </button>
                  <button
                    className="session-action-btn"
                    style={{ padding: '9px 16px', fontSize: 13, borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => { setSuccessData(null); setScanningStatus('idle') }}
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 13px', fontSize: 12, marginBottom: 12, color: '#1e40af' }}>
                  <b>Self Check-In:</b> Point your camera at the <strong>session QR code</strong> displayed by your trainer or on the training room door.
                </div>

                <div className="qr-camera-column">
                  <div className="qr-camera-wrap" style={{ aspectRatio: '4/3' }}>
                    {cameraActive && !cameraError ? (
                      <>
                        <video ref={videoRef} className="qr-camera-feed" />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div className="qr-target-overlay">
                          <div className="qr-scan-corners" />
                          <div className="qr-laser-line" />
                          <div className="qr-scan-hint">Point at Training Session QR Code</div>
                        </div>
                      </>
                    ) : (
                      <div className="qr-camera-fallback">
                        <Camera size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13 }}>Camera is paused</p>
                        <small style={{ color: '#94a3b8' }}>{cameraError || 'Click below to start camera.'}</small>
                        <button
                          className="session-action-btn primary"
                          style={{ marginTop: 10, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                          onClick={() => { setCameraError(''); setCameraActive(true) }}
                        >
                          <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} /> Start Camera
                        </button>
                      </div>
                    )}

                    {scanningStatus !== 'idle' && (
                      <div className={'qr-scan-feedback ' + scanningStatus} style={{ flexWrap: 'wrap', wordBreak: 'break-word' }}>
                        {scanningStatus === 'processing' && <RefreshCw size={14} className="animate-spin" style={{ flexShrink: 0 }} />}
                        {scanningStatus === 'success' && <CheckCircle2 size={16} style={{ flexShrink: 0 }} />}
                        {scanningStatus === 'error' && <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                        <span style={{ flex: 1 }}>{statusMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="qr-camera-controls" style={{ marginTop: 8 }}>
                    <button className="qr-ctrl-btn" onClick={() => setFacingMode(p => p === 'environment' ? 'user' : 'environment')}>
                      <RefreshCw size={13} /> Flip Camera
                    </button>
                    <button className="qr-ctrl-btn" onClick={() => setSoundEnabled(v => !v)}>
                      {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                      {soundEnabled ? 'Chime ON' : 'Muted'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
