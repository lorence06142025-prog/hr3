import React, { useState, useEffect } from 'react'
import { X, BookOpen, Play, FileText, Download, ExternalLink, Clock, Tag, ChevronRight, Sparkles } from 'lucide-react'
import { exportCourseAsPdf } from '../lib/exportUtils'
import { getAiCurriculumForCourse } from '../workflowConfig'

function getYouTubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}
function getVimeoId(url = '') {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? m[1] : null
}
function isPdf(url = '') {
  return /\.pdf(\?.*)?$/i.test(url) || url.includes('drive.google.com/file') || url.includes('docs.google.com/viewer')
}
function getEmbedUrl(videoUrl = '') {
  const ytId = getYouTubeId(videoUrl)
  if (ytId) return `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`
  const vimeoId = getVimeoId(videoUrl)
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0`
  return null
}

function RichTextRenderer({ content = '' }) {
  if (!content.trim()) return (
    <div className="ccv-empty-state">
      <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
      <p>No lesson content added yet.</p>
      <small>HR can add rich-text lesson notes when editing this course.</small>
    </div>
  )
  const lines = content.split('\n')
  const renderInline = (text) => {
    const parts = []
    let key = 0, last = 0
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let match
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index))
      if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>)
      last = match.index + match[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
  }
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^### /.test(line)) { elements.push(<h4 key={i} className="ccv-lesson-h4">{line.slice(4)}</h4>) }
    else if (/^## /.test(line)) { elements.push(<h3 key={i} className="ccv-lesson-h3">{line.slice(3)}</h3>) }
    else if (/^# /.test(line)) { elements.push(<h2 key={i} className="ccv-lesson-h2">{line.slice(2)}</h2>) }
    else if (/^---+$/.test(line.trim())) { elements.push(<hr key={i} className="ccv-lesson-hr" />) }
    else if (/^[*-] /.test(line)) {
      const bullets = []
      while (i < lines.length && /^[*-] /.test(lines[i])) { bullets.push(<li key={i}>{renderInline(lines[i].slice(2))}</li>); i++ }
      elements.push(<ul key={`ul-${i}`} className="ccv-lesson-ul">{bullets}</ul>); continue
    } else if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>); i++ }
      elements.push(<ol key={`ol-${i}`} className="ccv-lesson-ol">{items}</ol>); continue
    } else if (/^> /.test(line)) { elements.push(<blockquote key={i} className="ccv-lesson-blockquote">{renderInline(line.slice(2))}</blockquote>) }
    else if (line.trim() === '') { elements.push(<div key={i} className="ccv-lesson-spacer" />) }
    else { elements.push(<p key={i} className="ccv-lesson-p">{renderInline(line)}</p>) }
    i++
  }
  return <div className="ccv-lesson-body">{elements}</div>
}

export default function CourseContentViewer({ resource, onClose }) {
  const rawVideoUrl = resource.video_url || resource.videoUrl || ''
  const isGenericUrlVideo = !rawVideoUrl && (getYouTubeId(resource.url || '') || getVimeoId(resource.url || ''))
  const videoUrl = rawVideoUrl || (isGenericUrlVideo ? resource.url : '')

  const rawPdfUrl = resource.pdf_url || resource.pdfUrl || ''
  const isGenericUrlPdf = !rawPdfUrl && isPdf(resource.url || '')
  const pdfUrl = rawPdfUrl || (isGenericUrlPdf ? resource.url : '')

  const rawLessonContent = resource.lesson_content || resource.lessonContent || ''
  const isAiProvided = !rawLessonContent.trim()
  const effectiveLessonContent = rawLessonContent.trim() || getAiCurriculumForCourse(resource)

  const hasVideo = !!videoUrl
  const hasPdf = true // Always available via dynamic course document generator & exporter
  const embedUrl = getEmbedUrl(videoUrl)
  const isYouTube = !!getYouTubeId(videoUrl)
  const isVimeo = !!getVimeoId(videoUrl)
  const defaultTab = hasVideo ? 'video' : 'lesson'
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs = [
    { key: 'lesson', label: 'Lesson Guide', icon: BookOpen },
    hasVideo ? { key: 'video', label: 'Video', icon: Play } : null,
    { key: 'pdf', label: 'Curriculum & PDF', icon: FileText },
  ].filter(Boolean)

  return (
    <div className="ccv-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ccv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ccv-header">
          <div className="ccv-header-meta">
            <div className="ccv-header-badges">
              <span className={`ccv-badge ${resource.provider_type === 'internal' ? 'internal' : 'external'}`}>
                {resource.provider_type === 'internal' ? 'Internal Training' : 'External Course'}
              </span>
              <span className="ccv-badge category">{resource.category}</span>
              {resource.duration_hours && (
                <span className="ccv-badge duration">
                  <Clock size={10} style={{ display:'inline', marginRight:3 }} />
                  {resource.duration_hours}h
                </span>
              )}
            </div>
            <h2 className="ccv-title">{resource.title}</h2>
            {resource.provider && <p className="ccv-provider">{resource.provider}</p>}
          </div>
          <button className="ccv-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="ccv-tabs">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`ccv-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
              <Icon size={13} />{label}
            </button>
          ))}
          {(resource.competencies || []).length > 0 && (
            <div className="ccv-tab-comp-tags">
              {(resource.competencies || []).map(c => (
                <span key={c} className="ccv-comp-tag"><Tag size={9} />{c}</span>
              ))}
            </div>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="ccv-body">
          {activeTab === 'lesson' && (
            <div className="ccv-lesson-panel">
              {isAiProvided && (
                <div className="ccv-ai-banner">
                  <Sparkles size={14} style={{ flexShrink: 0 }} />
                  <span>Hospitality AI has automatically generated this structured Curriculum & Lesson Guide based on hospitality standards.</span>
                </div>
              )}

              <div className="ccv-overview">
                <p className="ccv-overview-desc">{resource.description}</p>
                {resource.objectives && (
                  <div className="ccv-overview-objectives">
                    <strong>Learning Objectives</strong>
                    <ul>
                      {resource.objectives.split(';').filter(Boolean).map((o, i) => (
                        <li key={i}><ChevronRight size={11} style={{ display:'inline', marginRight:4, opacity:0.6 }} />{o.trim()}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="ccv-lesson-divider">
                <span>Curriculum & Lesson Modules</span>
              </div>

              <RichTextRenderer content={effectiveLessonContent} />

              {resource.url && !isPdf(resource.url) && !hasVideo && (
                <a className="ccv-external-link" href={resource.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} /> Open full resource
                </a>
              )}
            </div>
          )}

          {activeTab === 'video' && (
            <div className="ccv-video-panel">
              {embedUrl ? (
                <div className="ccv-embed-wrap">
                  <iframe src={embedUrl} title={resource.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="ccv-embed-iframe" />
                </div>
              ) : videoUrl ? (
                <div className="ccv-embed-wrap">
                  <video controls className="ccv-embed-iframe" src={videoUrl}>Your browser does not support video.</video>
                </div>
              ) : (
                <div className="ccv-empty-state">
                  <Play size={32} style={{ opacity:0.3, marginBottom:8 }} />
                  <p>No video URL configured.</p>
                  <small>HR can add a YouTube, Vimeo, or direct video URL when editing this course.</small>
                </div>
              )}
              {(isYouTube || isVimeo) && (
                <a className="ccv-external-link" href={videoUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} /> Open on {isYouTube ? 'YouTube' : 'Vimeo'}
                </a>
              )}
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="ccv-pdf-panel">
              <div className="ccv-pdf-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <FileText size={14} style={{ color: '#111827', flexShrink: 0 }} />
                  <span className="ccv-pdf-name" style={{ fontWeight: 700, color: 'inherit' }}>
                    {resource.title} — Official Training Document
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="ccv-external-link" style={{ margin: 0, padding: '5px 10px', fontSize: 11 }}>
                      <ExternalLink size={12} /> Source Link ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => exportCourseAsPdf(resource)}
                    className="ccv-download-btn"
                    title="Generate and print/save this complete training course as a PDF document"
                  >
                    <Download size={13} /> Download / Print PDF
                  </button>
                </div>
              </div>

              {/* Formatted Course Document Preview with Dark Mode styling */}
              <div className="ccv-doc-preview">
                {isAiProvided && (
                  <div className="ccv-ai-banner">
                    <Sparkles size={14} style={{ flexShrink: 0 }} />
                    <span>Curriculum & Lesson Guide provided by Hospitality AI. Ready to study and export to PDF.</span>
                  </div>
                )}

                <div className="ccv-meta-grid">
                  <div className="ccv-meta-cell">
                    <small>Course Code</small>
                    <b>{(resource.category || 'GEN').slice(0, 3).toUpperCase()}-{String(resource.duration_hours || 4).padStart(2, '0')}</b>
                  </div>
                  <div className="ccv-meta-cell">
                    <small>Provider</small>
                    <b>{resource.provider || 'Internal Training'}</b>
                  </div>
                  <div className="ccv-meta-cell">
                    <small>Duration</small>
                    <b>{resource.duration_hours ? `${resource.duration_hours} hrs` : 'Self-Paced'}</b>
                  </div>
                  <div className="ccv-meta-cell">
                    <small>Competency</small>
                    <b>{(resource.competencies || []).join(', ') || 'Skill Development'}</b>
                  </div>
                </div>

                <div className="ccv-doc-card">
                  <h4>Course Description & Overview</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{resource.description}</p>
                </div>

                {resource.objectives && (
                  <div className="ccv-objectives-box">
                    <h4>Learning Objectives</h4>
                    <ul>
                      {resource.objectives.split(';').filter(Boolean).map((o, i) => (
                        <li key={i}>{o.trim()}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Curriculum & Lesson Material
                    </h4>
                    {isAiProvided && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={11} /> AI Generated
                      </span>
                    )}
                  </div>
                  <div className="ccv-lesson-box">
                    <RichTextRenderer content={effectiveLessonContent} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
