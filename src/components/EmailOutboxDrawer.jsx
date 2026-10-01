import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Mail, Inbox, RotateCw, X, CheckCircle, Zap, Send, ExternalLink, AlertCircle } from 'lucide-react'

export default function EmailOutboxDrawer({ isOpen, onClose }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState(null)

  // Test email state
  const [showTestForm, setShowTestForm] = useState(false)
  const [testTo, setTestTo] = useState('celsigarcia036@gmail.com')
  const [testSubject, setTestSubject] = useState('Priority Handling Services, Inc. Notification Test')
  const [testMessage, setTestMessage] = useState('This is a test notification from Priority Handling Services, Inc. to verify live SMTP email delivery.')
  const [sendingTest, setSendingTest] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.emailOutbox()
      setEmails(result.emails || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async (e) => {
    e.preventDefault()
    if (!testTo) return
    setSendingTest(true)
    setError('')
    setNotice('')
    try {
      const result = await api.sendTestEmail({
        to: testTo,
        subject: testSubject,
        message: testMessage,
      })
      setNotice(result.previewUrl ? `Email sent! View sandbox preview link below.` : `Email dispatched successfully to ${testTo}.`)
      setShowTestForm(false)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to dispatch test email.')
    } finally {
      setSendingTest(false)
    }
  }

  useEffect(() => {
    if (isOpen) { load() }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="outbox-drawer-wrapper">
      {/* Backdrop */}
      <div className="outbox-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="outbox-drawer-box">
        {/* Header */}
        <div className="outbox-head">
          <div>
            <div className="outbox-title-row">
              <span className="outbox-icon"><Mail className="w-5 h-5 text-gray-900" /></span>
              <h2>Live Email Outbox &amp; Delivery</h2>
              <span className="outbox-role-badge">HR / Management</span>
            </div>
            <p className="outbox-sub">
              Real-time SMTP dispatch queue, notification delivery logs, and sandbox viewer.
            </p>
          </div>
          <div className="outbox-actions">
            <button
              onClick={() => setShowTestForm(!showTestForm)}
              className="outbox-refresh-btn flex items-center gap-1"
              style={{ background: '#111827', color: '#fff', border: 'none' }}
              title="Send a live test email"
            >
              <Send size={13} className="inline" /> Test SMTP
            </button>
            <button onClick={load} className="outbox-refresh-btn flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 inline" /> Refresh
            </button>
            <button onClick={onClose} className="outbox-close-btn flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Test Email Dispatch Panel */}
        {showTestForm && (
          <form onSubmit={handleSendTest} style={{ margin: '12px 16px 0', padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Dispatch Test Email</span>
              <button type="button" onClick={() => setShowTestForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>Recipient Email:</span>
                <input
                  type="email"
                  required
                  value={testTo}
                  onChange={e => setTestTo(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>Subject:</span>
                <input
                  type="text"
                  required
                  value={testSubject}
                  onChange={e => setTestSubject(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>Message Content:</span>
                <textarea
                  rows={2}
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowTestForm(false)}
                  style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  style={{ padding: '5px 14px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                >
                  {sendingTest ? 'Sending…' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Notices and Banners */}
        {notice && (
          <div style={{ margin: '12px 16px 0', padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div style={{ margin: '12px 16px 0', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="outbox-body">
          {loading ? (
            <div className="outbox-loading">Loading outbox…</div>
          ) : emails.length === 0 ? (
            <div className="outbox-empty">
              <div className="outbox-empty-icon"><Inbox size={32} className="opacity-40" /></div>
              <b>No emails dispatched yet</b>
              <p>
                Emails are recorded here when the system sends workflow actions, training notifications, or test emails.
              </p>
            </div>
          ) : (
            <div className="outbox-card-list">
              {emails.map((email) => (
                <article key={email.id} className="outbox-card">
                  {/* Email header row */}
                  <button
                    onClick={() => setExpanded(expanded === email.id ? null : email.id)}
                    className="outbox-card-btn"
                  >
                    <span className="outbox-mail-circle"><Mail size={14} /></span>
                    <div className="outbox-mail-meta">
                      <b>{email.subject}</b>
                      <small>
                        To: {email.to} · {new Date(email.sentAt).toLocaleString()}
                      </small>
                    </div>
                    <span className={`outbox-status-pill ${email.status === 'sent' ? 'sent' : 'demo'}`}>
                      {email.status === 'sent' ? <><CheckCircle className="w-3 h-3 inline mr-1 text-emerald-400" /> Sent</> : <><Zap className="w-3 h-3 inline mr-1 text-amber-400" /> Demo</>}
                    </span>
                  </button>

                  {/* Expanded body */}
                  {expanded === email.id && (
                    <div className="outbox-card-details">
                      {email.previewUrl && (
                        <div style={{ marginBottom: 10, padding: '8px 10px', background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: '#374151' }}>Real Sandbox Web Preview:</span>{' '}
                          <a href={email.previewUrl} target="_blank" rel="noreferrer" style={{ color: '#111827', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            Open Live Rendered Email <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      <pre className="outbox-code-block">
                        {email.text || '(No body content)'}
                      </pre>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="outbox-foot">
          <p>
            {emails.length} email{emails.length !== 1 ? 's' : ''} recorded · SMTP Delivery &amp; Live Inspection enabled
          </p>
        </div>
      </div>
    </div>
  )
}
