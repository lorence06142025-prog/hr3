import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import TwoFactorModal from './TwoFactorModal'

const RELATIONSHIPS = [
  'Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Guardian', 'Colleague', 'Other',
]

function compress(file, maxDim = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UserProfileModal({ onClose, onAvatarUpdate }) {
  const [tab, setTab] = useState('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')

  const [profile, setProfile] = useState(null)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [ecName, setEcName] = useState('')
  const [ecPhone, setEcPhone] = useState('')
  const [ecRel, setEcRel] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarData, setAvatarData] = useState(undefined)

  const [email, setEmail] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)

  const fileRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    api.getProfileMe().then((res) => {
      setProfile(res)
      const emp = res.employee || {}
      const usr = res.user || {}
      setPhone(emp.phone || '')
      setAddress(emp.address || '')
      setEcName(emp.emergencyContactName || '')
      setEcPhone(emp.emergencyContactPhone || '')
      setEcRel(emp.emergencyContactRelationship || '')
      setAvatarPreview(emp.avatarUrl || usr.avatarUrl || null)
      setEmail(usr.email || '')
    }).catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [])

  const handleAvatar = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return }
    try {
      const compressed = await compress(file)
      setAvatarPreview(compressed)
      setAvatarData(compressed)
    } catch { setError('Failed to process image.') }
  }, [])

  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setAvatarData(null)
  }

  const savePersonal = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        phone,
        address,
        emergencyContactName: ecName,
        emergencyContactPhone: ecPhone,
        emergencyContactRelationship: ecRel,
      }
      if (avatarData !== undefined) payload.avatarUrl = avatarData
      const res = await api.updateProfileMe(payload)
      const newAvatarUrl = res.avatarUrl !== undefined ? res.avatarUrl : avatarData

      try {
        const stored = JSON.parse(localStorage.getItem('pds-user') || '{}')
        if (stored && typeof stored === 'object') {
          stored.avatarUrl = newAvatarUrl
          localStorage.setItem('pds-user', JSON.stringify(stored))
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('pds:user-updated', { detail: { avatarUrl: newAvatarUrl } }))
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))

      if (avatarData !== undefined && onAvatarUpdate) onAvatarUpdate(newAvatarUrl)
      showToast('Personal profile saved successfully!')
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally { setSaving(false) }
  }

  const saveAccount = async (e) => {
    e.preventDefault()
    setError('')
    if (newPw && newPw !== confirmPw) { setError('New passwords do not match.'); return }
    if (newPw && newPw.length < 6) { setError('Password must be at least 6 characters.'); return }
    setSaving(true)
    try {
      const payload = {}
      const usr = profile?.user || {}
      if (email && email.toLowerCase() !== (usr.email || '').toLowerCase()) payload.email = email
      if (newPw) { payload.currentPassword = currentPw; payload.newPassword = newPw }
      if (!Object.keys(payload).length) { showToast('No changes to save.', 'info'); setSaving(false); return }
      await api.updateAccountMe(payload)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      showToast('Account settings updated!')
    } catch (err) {
      setError(err.message || 'Failed to update account.')
    } finally { setSaving(false) }
  }

  const pwStrength = (pw) => {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  }

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#ef4444', '#f59e0b', '#22c55e', '#16a34a']
  const str = pwStrength(newPw)

  if (show2FA) {
    return <TwoFactorModal onClose={() => setShow2FA(false)} />
  }

  const EyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
  const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )

  return (
    <div className="upm-overlay" onClick={(e) => { if (e.target.classList.contains('upm-overlay')) onClose() }}>
      <div className="upm-modal">
        <div className="upm-header">
          <div className="upm-header-left">
            <div className="upm-avatar-wrap">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="upm-avatar-img" />
                : <span className="upm-avatar-initials">{profile?.user?.fullName?.match(/\b\w/g)?.slice(0, 2).join('').toUpperCase() || '?'}</span>
              }
              <button className="upm-avatar-edit-btn" title="Change photo" onClick={() => fileRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="upm-file-hidden" onChange={handleAvatar} />
            </div>
            <div className="upm-header-info">
              <h3>{profile?.employee?.fullName || profile?.user?.fullName || '—'}</h3>
              <p>{profile?.employee?.jobTitle || '—'} · {profile?.employee?.department || '—'}</p>
              <span className="upm-emp-badge">#{profile?.employee?.employeeNumber || '—'}</span>
            </div>
          </div>
          <button className="upm-close-btn" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {avatarPreview && (
          <div className="upm-avatar-actions">
            <button type="button" className="upm-link-btn" onClick={() => fileRef.current?.click()}>Change photo</button>
            <span className="upm-sep">·</span>
            <button type="button" className="upm-link-btn upm-remove" onClick={handleRemoveAvatar}>Remove</button>
          </div>
        )}

        <div className="upm-tabs">
          <button className={`upm-tab ${tab === 'personal' ? 'active' : ''}`} onClick={() => { setTab('personal'); setError('') }}>Personal & Emergency</button>
          <button className={`upm-tab ${tab === 'account' ? 'active' : ''}`} onClick={() => { setTab('account'); setError('') }}>Account & Security</button>
        </div>

        {toast && <div className={`upm-toast upm-toast-${toast.type}`}>{toast.msg}</div>}
        {error && <div className="upm-error">{error}</div>}
        {loading && <div className="upm-loading">Loading profile…</div>}

        {!loading && tab === 'personal' && (
          <form className="upm-form" onSubmit={savePersonal}>
            <div className="upm-section-label">Contact Information</div>
            <div className="upm-field">
              <label>Phone Number</label>
              <input type="tel" placeholder="+63 917 000 0000" value={phone} onChange={e => setPhone(e.target.value)} maxLength={50} />
            </div>
            <div className="upm-field">
              <label>Home Address</label>
              <textarea rows={2} placeholder="Street, City, Province, ZIP" value={address} onChange={e => setAddress(e.target.value)} maxLength={300} />
            </div>
            <div className="upm-section-label upm-section-label--mt">Emergency Contact</div>
            <div className="upm-field-row">
              <div className="upm-field">
                <label>Contact Name</label>
                <input type="text" placeholder="Full name" value={ecName} onChange={e => setEcName(e.target.value)} maxLength={120} />
              </div>
              <div className="upm-field">
                <label>Contact Phone</label>
                <input type="tel" placeholder="+63 917 000 0000" value={ecPhone} onChange={e => setEcPhone(e.target.value)} maxLength={50} />
              </div>
            </div>
            <div className="upm-field">
              <label>Relationship</label>
              <select value={ecRel} onChange={e => setEcRel(e.target.value)}>
                <option value="">Select relationship…</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="upm-actions">
              <button type="submit" className="upm-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}

        {!loading && tab === 'account' && (
          <form className="upm-form" onSubmit={saveAccount}>
            <div className="upm-section-label">Email Address</div>
            <div className="upm-field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="upm-section-label upm-section-label--mt">Change Password</div>
            <div className="upm-field">
              <label>Current Password</label>
              <div className="upm-pw-wrap">
                <input type={showCurrentPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                <button type="button" className="upm-pw-peek" onClick={() => setShowCurrentPw(v => !v)}>{showCurrentPw ? <EyeOff /> : <EyeOpen />}</button>
              </div>
            </div>
            <div className="upm-field">
              <label>New Password</label>
              <div className="upm-pw-wrap">
                <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password" />
                <button type="button" className="upm-pw-peek" onClick={() => setShowNewPw(v => !v)}>{showNewPw ? <EyeOff /> : <EyeOpen />}</button>
              </div>
              {newPw && (
                <div className="upm-pw-strength">
                  <div className="upm-pw-bar"><div className="upm-pw-fill" style={{ width: (str * 25) + '%', background: strengthColor[str] }} /></div>
                  <span style={{ color: strengthColor[str] }}>{strengthLabel[str]}</span>
                </div>
              )}
            </div>
            <div className="upm-field">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
              {confirmPw && newPw !== confirmPw && <small className="upm-mismatch">Passwords don't match</small>}
            </div>
            <div className="upm-section-label upm-section-label--mt">Two-Factor Authentication</div>
            <div className="upm-2fa-row">
              <div>
                <p className="upm-2fa-title">Google Authenticator (TOTP)</p>
                <p className="upm-2fa-desc">Protect your account with a time-based one-time password.</p>
              </div>
              <button type="button" className="upm-btn-outline" onClick={() => setShow2FA(true)}>
                {profile?.user?.twoFactorEnabled ? 'Manage 2FA' : 'Set Up 2FA'}
              </button>
            </div>
            <div className="upm-actions">
              <button type="submit" className="upm-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Account Settings'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
