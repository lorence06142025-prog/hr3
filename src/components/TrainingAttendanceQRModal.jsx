import React, { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import QRCodeImage from './QRCodeImage'
import { api } from '../lib/api'
import {
  X, Camera, QrCode, UserCheck, Users, CheckCircle2, AlertCircle,
  RefreshCw, Volume2, VolumeX, Sparkles, Printer, Search, ShieldCheck
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

export default function TrainingAttendanceQRModal({ session, onClose, onAttendanceUpdated, employees = [] }) {
  const [activeTab, setActiveTab] = useState('scanner')
  const [cameraActive, setCameraActive] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  const [scannedLogs, setScannedLogs] = useState([])
  const [lastScanned, setLastScanned] = useState(null)
  const [scanningStatus, setScanningStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [badgeSearch, setBadgeSearch] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameId = useRef(null)
  const isProcessingRef = useRef(false)
  const lastScannedCodeRef = useRef('')
  const lastScannedTimeRef = useRef(0)

  const sessionQrPayload = typeof window !== 'undefined'
    ? `${window.location.origin}/training?checkin=${session.id}`
    : JSON.stringify({
        type: 'pds_training_session',
        sessionId: session.id,
        title: session.title,
        venue: session.venue,
        startDate: session.start_date,
        category: session.category,
      })

  const handleProcessScan = useCallback(async (code) => {
    if (!code) return
    const now = Date.now()
    if (code === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 2500) {
      return
    }
    lastScannedCodeRef.current = code
    lastScannedTimeRef.current = now

    // If a session QR code was accidentally scanned with the supervisor camera
    if (code.includes('checkin=') || code.includes('pds_training_session')) {
      setScanningStatus('error')
      setStatusMessage('This is a Session Check-in Pass. Please point the camera at an Employee Badge QR.')
      setTimeout(() => setScanningStatus('idle'), 3000)
      return
    }

    isProcessingRef.current = true
    setScanningStatus('processing')
    setStatusMessage('Verifying employee badge...')

    try {
      const res = await api.scanTrainingAttendance(session.id, { code, status: 'present' })
      if (res.success) {
        if (soundEnabled) playSuccessChime()
        setScanningStatus('success')
        setStatusMessage('✓ Attendance is recorded: ' + res.employee.full_name + ' (' + res.employee.employee_number + ') — PRESENT')
        setLastScanned(res.employee)
        setScannedLogs(prev => [
          {
            id: res.employee.id,
            name: res.employee.full_name,
            number: res.employee.employee_number,
            department: res.employee.department,
            jobTitle: res.employee.job_title,
            time: new Date().toLocaleTimeString(),
            status: 'present'
          },
          ...prev.filter(l => l.id !== res.employee.id)
        ])
        if (onAttendanceUpdated) onAttendanceUpdated()
      }
    } catch (err) {
      setScanningStatus('error')
      setStatusMessage(err.message || 'Badge could not be verified.')
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false
        setScanningStatus('idle')
      }, 3500)
    }
  }, [session.id, soundEnabled, onAttendanceUpdated])

  useEffect(() => {
    if (activeTab !== 'scanner' || !cameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
      return
    }

    let streamInstance = null
    let active = true

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
    })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamInstance = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.play().catch(() => {})
        }
        setCameraError('')
      })
      .catch(err => {
        setCameraError('Camera access denied or unavailable. You can use the manual badge input below.')
      })

    const scanFrame = () => {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !isProcessingRef.current) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (qrCode && qrCode.data) {
          handleProcessScan(qrCode.data)
        }
      }
      animFrameId.current = requestAnimationFrame(scanFrame)
    }

    animFrameId.current = requestAnimationFrame(scanFrame)

    return () => {
      active = false
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop())
      }
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
    }
  }, [activeTab, cameraActive, facingMode, handleProcessScan])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleProcessScan(manualCode.trim())
    setManualCode('')
  }

  const handlePrintSessionPass = () => {
    const printWin = window.open('', '_blank', 'width=800,height=700')
    if (!printWin) return
    printWin.document.write(
      '<!DOCTYPE html><html><head><title>' + session.title + ' — Training QR Pass</title>' +
      '<style>body { font-family: Inter, sans-serif; text-align: center; padding: 40px; color: #1e1b4b; }' +
      '.header { border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }' +
      '.badge { display: inline-block; padding: 4px 12px; background: #f3f4f6; color: #111827; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }' +
      '.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 400px; margin: 20px auto; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 13px; text-align: left; }' +
      '.qr-box { margin: 28px auto; padding: 20px; border: 2px dashed #111827; border-radius: 16px; display: inline-block; }' +
      '</style></head><body>' +
      '<div class="header"><span class="badge">' + session.category + '</span><h1 style="margin-top:8px;">' + session.title + '</h1><p>PerDevSys Hospitality Training · Live Attendance</p></div>' +
      '<div class="meta"><div><strong>Venue:</strong> ' + session.venue + '</div><div><strong>Date:</strong> ' + String(session.start_date).slice(0, 10) + '</div><div><strong>Time:</strong> ' + session.start_time + '</div><div><strong>Trainer:</strong> ' + (session.trainer || 'HR Specialist') + '</div></div>' +
      '<div class="qr-box"><div style="font-weight:700;margin-bottom:8px;font-size:12px;text-transform:uppercase;color:#111827;">Scan to Check In</div><img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(sessionQrPayload) + '" width="220" height="220" /></div>' +
      '<p>Open your mobile camera or employee app and scan to record attendance as <strong>PRESENT</strong>.</p>' +
      '</body></html>'
    )
    printWin.document.close()
    printWin.focus()
    setTimeout(() => { printWin.print() }, 400)
  }

  const filteredBadges = employees.filter(e =>
    (e.full_name + ' ' + e.employee_number + ' ' + e.department + ' ' + e.job_title).toLowerCase().includes(badgeSearch.toLowerCase())
  )

  return (
    <div className="training-modal-overlay" role="dialog" aria-modal="true">
      <div className="training-modal-content qr-attendance-modal" style={{ maxWidth: 840 }}>
        <div className="training-modal-header" style={{ padding: '16px 22px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="session-category-tag" style={{ margin: 0 }}>{session.category}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                LIVE ATTENDANCE
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{session.title}</h3>
            <small style={{ color: '#64748b' }}>
              Venue: <b>{session.venue}</b> · Date: <b>{String(session.start_date).slice(0, 10)} ({session.start_time})</b>
            </small>
          </div>
          <button className="training-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="qr-tabs-nav">
          <button className={'qr-tab-btn ' + (activeTab === 'scanner' ? 'active' : '')} onClick={() => setActiveTab('scanner')}>
            <Camera size={14} /> Camera Scanner
          </button>
          <button className={'qr-tab-btn ' + (activeTab === 'session_qr' ? 'active' : '')} onClick={() => setActiveTab('session_qr')}>
            <QrCode size={14} /> Display Session QR
          </button>
          <button className={'qr-tab-btn ' + (activeTab === 'badges' ? 'active' : '')} onClick={() => setActiveTab('badges')}>
            <Users size={14} /> Employee Badge QRs ({employees.length})
          </button>
        </div>

        {activeTab === 'scanner' && (
          <div className="qr-scanner-view-grid">
            <div className="qr-camera-column">
              <div className="qr-camera-wrap">
                {cameraActive && !cameraError ? (
                  <>
                    <video ref={videoRef} className="qr-camera-feed" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="qr-target-overlay">
                      <div className="qr-scan-corners" />
                      <div className="qr-laser-line" />
                      <div className="qr-scan-hint">Align Employee Badge QR Code inside frame</div>
                    </div>
                  </>
                ) : (
                  <div className="qr-camera-fallback">
                    <Camera size={42} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Camera scanner is paused or unavailable.</p>
                    <small style={{ color: '#94a3b8' }}>{cameraError || 'Click below to turn camera back on or use manual code entry.'}</small>
                    <button
                      type="button"
                      className="session-action-btn primary"
                      style={{ marginTop: 12, padding: '6px 14px', fontSize: 12 }}
                      onClick={() => { setCameraError(''); setCameraActive(true) }}
                    >
                      <RefreshCw size={12} className="inline mr-1" /> Start Camera
                    </button>
                  </div>
                )}

                {scanningStatus !== 'idle' && (
                  <div className={'qr-scan-feedback ' + scanningStatus}>
                    {scanningStatus === 'processing' && <RefreshCw size={14} className="animate-spin" />}
                    {scanningStatus === 'success' && <CheckCircle2 size={16} />}
                    {scanningStatus === 'error' && <AlertCircle size={16} />}
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>

              <div className="qr-camera-controls">
                <button
                  type="button"
                  className="qr-ctrl-btn"
                  onClick={() => setCameraActive(!cameraActive)}
                  title="Toggle Camera On/Off"
                >
                  <Camera size={13} /> {cameraActive ? 'Pause Camera' : 'Resume'}
                </button>
                <button
                  type="button"
                  className="qr-ctrl-btn"
                  onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  title="Switch Front/Back Camera"
                >
                  <RefreshCw size={13} /> Flip Lens
                </button>
                <button
                  type="button"
                  className="qr-ctrl-btn"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title="Toggle Scan Audio Chime"
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  {soundEnabled ? 'Chime ON' : 'Muted'}
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="qr-manual-entry-bar">
                <input
                  type="text"
                  placeholder="Enter Badge / Employee # (e.g. E018)"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                />
                <button type="submit" className="session-action-btn primary" style={{ padding: '6px 14px', fontSize: 12 }}>
                  Check In
                </button>
              </form>
            </div>

            <div className="qr-stream-column">
              <div className="qr-stream-head">
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Real-Time Attendance Feed</h4>
                  <small style={{ color: '#64748b' }}>{scannedLogs.length} employee(s) scanned in this session</small>
                </div>
                {lastScanned && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>
                    Active
                  </span>
                )}
              </div>

              <div className="qr-stream-list">
                {scannedLogs.length > 0 ? (
                  scannedLogs.map(log => (
                    <div key={log.id} className="qr-stream-item">
                      <div className="qr-stream-avatar">
                        {log.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.name}
                        </b>
                        <small style={{ color: '#64748b', fontSize: 11 }}>
                          {log.number} · {log.jobTitle || log.department}
                        </small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="session-status-badge present" style={{ fontSize: 9.5, padding: '2px 6px' }}>
                          PRESENT
                        </span>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{log.time}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="qr-stream-empty">
                    <UserCheck size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>Ready to scan attendance.</p>
                    <small>Point the camera at an employee badge QR code or type their employee number to record them present.</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'session_qr' && (
          <div className="qr-session-display-wrap">
            <div className="qr-session-display-card">
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span className="session-category-tag">{session.category}</span>
                <h3 style={{ margin: '8px 0 4px', fontSize: 18 }}>{session.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                  Venue: <b>{session.venue}</b> · Date: <b>{String(session.start_date).slice(0, 10)} ({session.start_time})</b>
                </p>
              </div>

              <div className="qr-code-large-box">
                <QRCodeImage value={sessionQrPayload} size={220} />
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Attendance Check-in QR
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', maxWidth: 440, margin: '0 auto', textAlign: 'left', fontSize: 12.5 }}>
                <b style={{ display: 'block', color: '#1e1b4b', marginBottom: 4 }}>How Self Check-In Works:</b>
                <p style={{ margin: '0 0 4px', color: '#475569' }}>1. Project this screen at the training room or print the physical pass.</p>
                <p style={{ margin: 0, color: '#475569' }}>2. Employees scan this QR code with their mobile device to record attendance instantly.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
                <button type="button" className="session-action-btn primary" onClick={handlePrintSessionPass}>
                  <Printer size={13} className="inline mr-1" /> Print Session Attendance Pass
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="qr-badges-directory-wrap">
            <div className="qr-badges-toolbar">
              <label className="qr-badge-search">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search employee badges by name, number, or department..."
                  value={badgeSearch}
                  onChange={e => setBadgeSearch(e.target.value)}
                />
              </label>
              <small style={{ color: '#64748b', fontWeight: 600 }}>
                Showing {filteredBadges.length} employee badge(s)
              </small>
            </div>

            <div className="qr-badges-grid">
              {filteredBadges.map(emp => {
                const badgeQr = JSON.stringify({
                  type: 'pds_employee_badge',
                  employeeId: emp.id,
                  employeeNumber: emp.employee_number,
                  name: emp.full_name,
                  department: emp.department
                })
                return (
                  <div key={emp.id} className="qr-badge-card">
                    <div className="qr-badge-qr-col">
                      <QRCodeImage value={badgeQr} size={64} />
                    </div>
                    <div className="qr-badge-info-col">
                      <div className="qr-badge-num">{emp.employee_number}</div>
                      <b className="qr-badge-name">{emp.full_name}</b>
                      <small className="qr-badge-role">{emp.job_title || emp.department}</small>
                      <button
                        type="button"
                        className="qr-badge-scan-btn"
                        onClick={() => {
                          handleProcessScan(emp.employee_number)
                          setActiveTab('scanner')
                        }}
                      >
                        <ShieldCheck size={11} /> Mark Present
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
