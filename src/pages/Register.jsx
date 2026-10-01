import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { CheckCircle } from 'lucide-react'

export default function Register() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  if (!token) {
    return (
      <main className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="login-card" style={{ textAlign: 'center', padding: 40 }}>
          <h1>Invalid link</h1>
          <p>This registration link is missing a valid invitation token. Please check the link you received.</p>
        </div>
      </main>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setSaving(true)
    try {
      const result = await api.register(token, password)
      localStorage.setItem('pds-token', result.token)
      localStorage.setItem('pds-user', JSON.stringify(result.user))
      setNotice('Account created! Redirecting...')
      setTimeout(() => navigate('/'), 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="login-card" style={{ padding: 40, maxWidth: 420 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <img className="register-brand-logo" src="/prioritylogo.png" alt="" />
          <span style={{ fontSize: 20, fontWeight: 700 }}>Priority Handling Services, Inc.</span>
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Create your account</h1>
        <p style={{ fontSize: 13, marginBottom: 20, color: '#666' }}>Complete your registration to access the system.</p>

        {notice && <p className="module-notice"><CheckCircle className="inline w-4 h-4 mr-1" /> {notice}</p>}
        {error && <p className="module-error" role="alert">{error}</p>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter your password" required />
          </label>
          <button className="module-primary" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
