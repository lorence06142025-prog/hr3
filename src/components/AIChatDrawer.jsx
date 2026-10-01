import React, { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { Sparkles, Maximize2, Minimize2, Lock, Zap } from 'lucide-react'

const SAMPLE_PROMPTS_BY_ROLE = {
  hr: [
    "List all employees across the organization.",
    "Who had the highest performance score this year?",
    "Which department has the largest competency gap?",
    "Which employees have incomplete learning activities?",
    "Which employees are Ready Now for succession?",
    "What learning resources are related to customer service competency?",
  ],
  management: [
    "List all employees across the organization.",
    "Who had the highest performance score this year?",
    "Which department has the largest competency gap?",
    "Which employees are Ready Now for succession?",
    "What is the average performance across the organization?",
  ],
  operations_manager: [
    "List all employees under my department.",
    "Which employees in my department have competency gaps?",
    "Show incomplete learning activities in my department.",
    "Which department team members have top performance?",
  ],
  supervisor: [
    "List all employees under my department.",
    "Which employees in my department have competency gaps?",
    "Show incomplete learning activities in my department.",
    "Which employees have recommended learning paths?",
  ],
  employee: [
    "What was my last performance score?",
    "What learning activities do I still need to complete?",
    "What competencies should I improve?",
    "What is my coworker's performance score?",
  ],
}

/**
 * Format markdown text: converts single asterisks (*word*) and double asterisks (**word**)
 * into strong bold elements, and renders lists and headers cleanly.
 */
function renderFormattedContent(text = '') {
  if (!text) return null

  // Normalize single asterisks surrounding words to double asterisks for bolding
  // e.g. *Identify Learning Needs:* -> **Identify Learning Needs:**
  let normalized = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '**$1**')

  const lines = normalized.split('\n')

  return lines.map((line, lineIdx) => {
    // Handle headings (e.g. ### Action Steps or ## Header)
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/)
    if (headingMatch) {
      return (
        <h4 key={lineIdx} style={{ margin: '10px 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1e1b2e' }}>
          {parseInlineBold(headingMatch[1])}
        </h4>
      )
    }

    // Handle bullet / numbered list items (e.g. 1. item or - item or • item)
    const listMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      return (
        <div key={lineIdx} style={{ paddingLeft: 8, margin: '4px 0', display: 'flex', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#111827', minWidth: 16 }}>{listMatch[2]}</span>
          <span style={{ flex: 1 }}>{parseInlineBold(listMatch[3])}</span>
        </div>
      )
    }

    // Empty line spacing
    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: 4 }} />
    }

    return (
      <div key={lineIdx} style={{ margin: '2px 0' }}>
        {parseInlineBold(line)}
      </div>
    )
  })
}

function parseInlineBold(text) {
  // Split by **bold** text blocks
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ fontWeight: 700, color: '#1e1b2e' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function AIChatDrawer({ isOpen, onClose, onOpen }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}') || {} } catch { return {} } })()
  const role = user.role || 'employee'
  const storageKey = `pds-ai-chat-${user.id || 'guest'}`
  const samples = SAMPLE_PROMPTS_BY_ROLE[role] || SAMPLE_PROMPTS_BY_ROLE.employee

  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  // When parent opens the drawer explicitly (e.g. from topbar button), restore from minimized state
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false)
    }
  }, [isOpen])

  // Load persisted chat history for this user (survives page refresh).
  // History is only cleared on logout (see App.jsx handleLogout).
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) return parsed
      }
    } catch { /* fall through to fresh greeting */ }
    return [
      {
        role: 'assistant',
        content: `Hi! I'm the **Priority Handling Services, Inc. AI Assistant**. I can help you explore workforce insights — including performance scores, skill gaps, training sessions, learning progress, and succession readiness — tailored to your role (${role.replace('_', ' ').toUpperCase()}). What would you like to know?`,
        summary: 'Ready',
      }
    ]
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [dataContextSummary, setDataContextSummary] = useState('')
  const messagesEndRef = useRef(null)

  // Persist chat history whenever it changes so it survives page refreshes.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch { /* storage may be unavailable */ }
  }, [messages, storageKey])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized])

  const handleOpen = () => {
    setIsMinimized(false)
    if (onOpen) onOpen()
  }

  const handleMinimize = (e) => {
    e.stopPropagation()
    setIsMinimized(true)
  }

  const handleToggleMaximize = (e) => {
    e.stopPropagation()
    setIsMaximized(prev => !prev)
  }

  const handleClose = (e) => {
    if (e) e.stopPropagation()
    setIsMinimized(false)
    if (onClose) onClose()
  }

  // Floating trigger button displayed on lower-right when drawer is closed or minimized
  const floatingTrigger = (!isOpen || isMinimized) ? (
    <button
      type="button"
      className="ai-chat-floating-btn"
      onClick={handleOpen}
      title="Open AI Assistant"
      aria-label="Open AI Assistant"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #111827 0%, #402b98 100%)',
        color: '#ffffff',
        border: '1.5px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 24px rgba(17, 24, 39, 0.45), 0 2px 8px rgba(0, 0, 0, 0.18)',
        cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px) scale(1.06)'
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(17, 24, 39, 0.55), 0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(17, 24, 39, 0.45), 0 2px 8px rgba(0, 0, 0, 0.18)'
      }}
    >
      <Sparkles size={22} style={{ opacity: 0.95 }} />
      {isMinimized && (
        <span
          title="Active Chat Session"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px #34d399',
            display: 'inline-block',
          }}
        />
      )}
    </button>
  ) : null

  if (!isOpen || isMinimized) {
    return floatingTrigger
  }

  const handleSend = async (textToSend) => {
    const prompt = (textToSend || input).trim()
    if (!prompt || sending) return

    setInput('')
    setError('')
    const newMsg = { role: 'user', content: prompt }
    const nextHistory = [...messages, newMsg]
    setMessages(nextHistory)
    setSending(true)

    try {
      const historyPayload = nextHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))

      const response = await api.chatAssistant({
        message: prompt,
        history: historyPayload,
      })

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          summary: response.dataContextSummary,
        }
      ])
      if (response.dataContextSummary) {
        setDataContextSummary(response.dataContextSummary)
      }
    } catch (err) {
      setError(err.message || 'Could not retrieve AI response.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="AI Chat Assistant" onClick={handleClose}>
        <aside
          className="settings-dialog ai-chat-drawer"
          onClick={e => e.stopPropagation()}
          style={{
            width: isMaximized ? 'min(920px, 95vw)' : 'min(580px, 92vw)',
            height: isMaximized ? '92vh' : '88vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), height 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
          }}
        >
          {/* Drawer Header with Window Controls */}
          <div className="ai-chat-header" style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #1e1b2e 0%, #2d264a 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} className="text-gray-400" />
                <h2 style={{ margin: 0, fontSize: 15, color: '#fff', fontWeight: 700 }}>Priority Handling Services, Inc. Assistant</h2>
                {isMaximized && (
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4, color: '#d8d1f7' }}>
                    Expanded
                  </span>
                )}
              </div>
              <small style={{ color: '#b6b0d6', fontSize: 11 }}>
                Smart Analytics · Role Scope: <b style={{ textTransform: 'uppercase', color: '#a795ff' }}>{role}</b>
              </small>
            </div>

            {/* Action Buttons: Minimize, Maximize/Restore, Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Minimize button */}
              <button
                type="button"
                onClick={handleMinimize}
                title="Minimize to floating widget on lower right"
                aria-label="Minimize"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  color: '#e2dff0',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)' }}
              >
                −
              </button>

              {/* Maximize / Restore Toggle button */}
              <button
                type="button"
                onClick={handleToggleMaximize}
                title={isMaximized ? 'Restore standard width' : 'Maximize window for larger view'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                style={{
                  background: isMaximized ? 'rgba(17, 24, 39, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  color: '#e2dff0',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isMaximized ? 'rgba(17, 24, 39, 0.4)' : 'rgba(255, 255, 255, 0.1)' }}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                title="Close chatbox"
                aria-label="Close"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  color: '#e2dff0',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.75)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.color = '#e2dff0'
                }}
              >
                ×
              </button>
            </div>
          </div>


        {/* Data Scope & Security Banner */}
        <div style={{
          padding: '8px 16px',
          background: '#f4f2fb',
          borderBottom: '1px solid #e5e2f0',
          fontSize: 11,
          color: '#554f6b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={12} /> Authorized Access Active</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>{dataContextSummary || 'Analytics Context Active'}</span>
        </div>

        {/* Messages Body */}
        <div className="ai-chat-body" style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#faf9fc',
        }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`ai-message ${m.role}`}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: m.role === 'user' ? '#111827' : '#ffffff',
                color: m.role === 'user' ? '#ffffff' : '#282631',
                boxShadow: '0 2px 8px rgba(40,34,70,0.04)',
                border: m.role === 'user' ? 'none' : '1px solid #ecebf0',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ fontSize: 10, color: '#8e8b95', marginBottom: 4, fontWeight: 700, display: 'flex', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Sparkles size={10} className="text-gray-700" /> AI ASSISTANT</span>
                  {m.summary && <span>· {m.summary}</span>}
                </div>
              )}
              <div>{renderFormattedContent(m.content)}</div>
            </div>
          ))}

          {sending && (
            <div className="ai-message assistant" style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 2px',
              background: '#ffffff',
              border: '1px solid #ecebf0',
              fontSize: 12,
              color: '#8e8b95',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <Sparkles size={12} className="text-white" /> Analyzing available data & generating response…
            </div>
          )}

          {error && (
            <div style={{ padding: 10, background: '#fff0ee', color: '#b23a2f', borderRadius: 8, fontSize: 11 }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Strip */}
        <div style={{ padding: '8px 14px', background: '#fff', borderTop: '1px solid #ecebf0' }}>
          <small style={{ fontSize: 10, color: '#8e8b95', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Suggested Questions:
          </small>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {samples.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={sending}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 10px',
                  borderRadius: 16,
                  border: '1px solid #e4e1f5',
                  background: '#f8f6ff',
                  color: '#111827',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Zap size={10} className="text-amber-500" /> {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => { e.preventDefault(); handleSend() }}
          style={{
            padding: 12,
            background: '#fff',
            borderTop: '1px solid #ecebf0',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about performance, training, skill gaps, or learning…"
            disabled={sending}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #dfdce6',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: '#111827',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              opacity: sending || !input.trim() ? 0.6 : 1,
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </aside>
    </div>
  </>
  )
}

