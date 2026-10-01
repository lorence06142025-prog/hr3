import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { Lock, KeyRound, Check, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function TwoFactorModal({ onClose }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const codeRef = useRef(null)

  useEffect(() => {
    api.get2FAStatus().then(r => {
      setStatus(r.enabled ? 'enabled' : 'idle')
      setLoading(false)
    }).catch(() => { setStatus('idle'); setLoading(false) })
  }, [])

  const startSetup = async () => {
    setError('')
    setLoading(true)
    try {
      const r = await api.setup2FA()
      setQrCode(r.qrCode)
      setSecret(r.secret)
      setStatus('setup')
      setCode('')
      setTimeout(() => codeRef.current && codeRef.current.focus(), 200)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const doEnable = async (e) => {
    e.preventDefault()
    if (!code || code.length < 6) { setError('Enter the 6-digit code from Google Authenticator.'); return }
    setError('')
    setLoading(true)
    try {
      const r = await api.enable2FA(code)
      setBackupCodes(r.backupCodes || [])
      setStatus('enabled')
      setSuccess(r.message || '2FA enabled!')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const doDisable = async (e) => {
    e.preventDefault()
    if (!disablePassword) { setError('Enter your password to confirm.'); return }
    setError('')
    setLoading(true)
    try {
      const r = await api.disable2FA(disablePassword)
      setStatus('idle')
      setSuccess(r.message || '2FA disabled.')
      setDisablePassword('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div
      className="settings-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-dialog" style={{ width: '100%', maxWidth: 430, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={17} /> Two-Factor Authentication</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, color: '#888', lineHeight: 1 }}>×</button>
        </div>

        {loading && <p style={{ color: '#888', textAlign: 'center' }}>Loading…</p>}

        {error && <div style={{ marginBottom: 12, padding: '9px 12px', background: '#fff0ed', color: '#ad4d3c', borderRadius: 8, fontSize: 12 }}>{error}</div>}
        {success && <div style={{ marginBottom: 12, padding: '9px 12px', background: '#f0fdf4', color: '#166534', borderRadius: 8, fontSize: 12, border: '1px solid #bbf7d0' }}>{success}</div>}

        {/* Idle state — not yet set up */}
        {!loading && status === 'idle' && (
          <div>
            <div style={{ background: '#f9f8ff', border: '1px solid #e5e0ff', borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Protect your account with Google Authenticator</p>
              <p style={{ margin: 0, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                After entering your password, you will also need a 6-digit code from your authenticator app to sign in.
              </p>
            </div>
            <button
              onClick={startSetup}
              disabled={loading}
              style={{ width: '100%', padding: '11px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              <KeyRound size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Set Up Google Authenticator
            </button>
          </div>
        )}

        {/* Setup state — QR Code */}
        {!loading && status === 'setup' && (
          <form onSubmit={doEnable}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#555' }}>
                <b>Step 1:</b> Open <strong>Google Authenticator</strong> on your phone.<br />
                <b>Step 2:</b> Tap <strong>+</strong> then <strong>Scan a QR code</strong>.<br />
                <b>Step 3:</b> Scan the QR code below.
              </p>
              {qrCode && (
                <img
                  src={qrCode}
                  alt="Google Authenticator QR Code"
                  style={{ width: 200, height: 200, border: '4px solid #f0ebff', borderRadius: 12 }}
                />
              )}
              <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 8, padding: '7px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 10, color: '#888' }}>Or enter this key manually in the app:</p>
                <code style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#5e3fd2', wordBreak: 'break-all' }}>{secret}</code>
              </div>
            </div>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 650, color: '#4e4a54', marginBottom: 12 }}>
              Step 4: Enter the 6-digit code shown in the app
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s+/g, ''))}
                placeholder="000000"
                required
                style={{ border: '1px solid #dcd9e4', borderRadius: 7, padding: '9px 12px', fontSize: 22, fontWeight: 700, textAlign: 'center', letterSpacing: 5, fontFamily: 'monospace' }}
              />
            </label>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}
            >
              {loading ? 'Verifying…' : <><Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Confirm and Activate 2FA</>}
            </button>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setError(''); setSuccess('') }}
              disabled={loading}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #dcd9e4', background: 'transparent', color: '#666', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel Setup
            </button>
          </form>
        )}

        {/* Enabled + showing backup codes */}
        {!loading && status === 'enabled' && backupCodes.length > 0 && (
          <div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} /> Save Your Backup Codes</p>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#78350f' }}>Store these somewhere safe. Each code can be used once to sign in if you lose access to your phone.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {backupCodes.map((c, i) => (
                  <code key={i} style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: 5, padding: '4px 8px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}>{c}</code>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Done — I&apos;ve saved my backup codes
            </button>
          </div>
        )}

        {/* Enabled — manage state */}
        {!loading && status === 'enabled' && backupCodes.length === 0 && (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={26} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: '#166534' }}>2FA is Active</p>
                <p style={{ margin: 0, fontSize: 11, color: '#14532d' }}>Your account is protected with Google Authenticator.</p>
              </div>
            </div>
            <button
              onClick={() => { setStatus('disabling'); setError(''); setSuccess('') }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}

        {/* Disabling confirmation */}
        {!loading && status === 'disabling' && (
          <form onSubmit={doDisable}>
            <div style={{ background: '#fff0ed', border: '1px solid #fca5a5', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 12, color: '#9b1c1c', display: 'flex', alignItems: 'center', gap: 5 }}><ShieldAlert size={13} /> Disabling 2FA reduces account security</p>
              <p style={{ margin: 0, fontSize: 11, color: '#7f1d1d' }}>Enter your password to confirm you want to turn off Two-Factor Authentication.</p>
            </div>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 650, color: '#4e4a54', marginBottom: 12 }}>
              Confirm your password
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your current password"
                required
                style={{ border: '1px solid #dcd9e4', borderRadius: 7, padding: '9px 12px', fontSize: 13 }}
              />
            </label>
            <button
              type="submit"
              disabled={loading || !disablePassword}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}
            >
              {loading ? 'Disabling…' : 'Yes, Disable 2FA'}
            </button>
            <button
              type="button"
              onClick={() => { setStatus('enabled'); setError('') }}
              disabled={loading}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #dcd9e4', background: 'transparent', color: '#666', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  )
}