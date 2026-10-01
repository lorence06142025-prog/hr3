import { getAiCurriculumForCourse } from '../workflowConfig'

/**
 * Shared CSV export utility.
 * Converts an array of objects to a CSV string and triggers a browser download.
 */
export function downloadCsv(rows, filename = 'export.csv') {
  if (!rows || rows.length === 0) return

  const escapeCell = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Triggers a browser PDF print for a given HTML element by ID.
 * Opens print preview with only that element visible.
 */
export function printElementAsPdf(elementId, title = 'Priority Handling Services, Inc. Report') {
  const el = document.getElementById(elementId)
  if (!el) return

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; }
        body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #1a1a2e; padding: 32px; }
        h1, h2, h3 { color: #2e2b5f; margin-bottom: 8px; }
        p, li { line-height: 1.6; font-size: 13px; color: #444; }
        ul { padding-left: 18px; margin: 8px 0; }
        .report-section { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e5f0; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #6a5acd; }
        .report-header h1 { font-size: 22px; }
        .report-header small { font-size: 11px; color: #888; }
        @media print { body { padding: 0; } }
      </style>
    <body>
      <div class="report-header">
        <h1>${title}</h1>
        <small>Generated: ${new Date().toLocaleString()}<br/>Priority Handling Services, Inc.</small>
      </div>
      ${el.innerHTML}
    </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => { printWindow.print() }, 500)
}

/**
 * Generates and triggers a print/PDF save dialog for a course/learning resource.
 * Creates a clean, formatted training curriculum document with metadata,
 * learning objectives, lesson notes, and verification sign-off.
 */
export function exportCourseAsPdf(resource) {
  if (!resource) return

  const printWindow = window.open('', '_blank', 'width=900,height=750')
  if (!printWindow) {
    alert('Please allow popups to download or print the course PDF.')
    return
  }

  const title = resource.title || 'Training Course'
  const category = resource.category || 'Skill Development'
  const provider = resource.provider || 'Internal Training'
  const duration = resource.duration_hours ? `${resource.duration_hours} Hours` : 'Flexible'
  const competencies = (resource.competencies || []).join(', ') || 'General Development'
  const description = resource.description || 'No description provided.'
  const objectives = (resource.objectives || '')
    .split(';')
    .filter(Boolean)
    .map(o => `<li>${o.trim()}</li>`)
    .join('')

  // Convert simple markdown in lesson_content (or AI curriculum fallback) to HTML
  const lessonRaw = resource.lesson_content || resource.lessonContent || getAiCurriculumForCourse(resource)
  const isAiProvided = !(resource.lesson_content || resource.lessonContent)
  const lessonHtml = lessonRaw
    ? lessonRaw
        .split('\n')
        .map(line => {
          if (/^### (.*)/.test(line)) return `<h4 style="margin:14px 0 4px;font-size:14px;color:#111827;">${line.replace(/^### /, '')}</h4>`
          if (/^## (.*)/.test(line)) return `<h3 style="margin:16px 0 6px;font-size:16px;color:#3730a3;">${line.replace(/^## /, '')}</h3>`
          if (/^# (.*)/.test(line)) return `<h2 style="margin:20px 0 8px;font-size:18px;color:#1e1b4b;">${line.replace(/^# /, '')}</h2>`
          if (/^[-*] (.*)/.test(line)) return `<li style="margin-bottom:4px;">${line.replace(/^[-*] /, '')}</li>`
          if (/^\d+\. (.*)/.test(line)) return `<li style="margin-bottom:4px;">${line.replace(/^\d+\. /, '')}</li>`
          if (/^> (.*)/.test(line)) return `<blockquote style="border-left:3px solid #111827;padding:6px 12px;margin:8px 0;background:#f3f4f6;color:#374151;font-style:italic;">${line.replace(/^> /, '')}</blockquote>`
          if (line.trim() === '') return `<div style="height:8px;"></div>`
          return `<p style="margin:0 0 6px;line-height:1.6;font-size:13px;color:#374151;">${line}</p>`
        })
        .join('')
    : '<p style="font-style:italic;color:#6b7280;">No extended lesson content provided for this module.</p>'

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${title} — Training Document</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; padding: 36px 44px; background: #fff; }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 22px; }
        .doc-header h1 { font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1.25; margin-bottom: 4px; }
        .doc-header .doc-badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 9px; border-radius: 20px; background: #f3f4f6; color: #111827; margin-right: 6px; }
        .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 22px; }
        .meta-item small { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
        .meta-item b { font-size: 12.5px; color: #1e293b; }
        .section-block { margin-bottom: 20px; }
        .section-block h3 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; }
        .section-block p { font-size: 13px; line-height: 1.65; color: #374151; }
        .objectives-list { padding-left: 18px; font-size: 13px; line-height: 1.7; color: #374151; }
        .lesson-container { background: #fafafa; border: 1px solid #f1f5f9; border-radius: 8px; padding: 16px 20px; }
        .signoff-box { margin-top: 32px; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 16px 20px; page-break-inside: avoid; }
        .signoff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 14px; }
        .signoff-line { border-bottom: 1px solid #94a3b8; height: 32px; margin-bottom: 4px; }
        .footer-note { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; }
        @media print {
          body { padding: 0; }
          .signoff-box { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <div>
          <div>
            <span class="doc-badge">${resource.provider_type === 'internal' ? 'Internal Training' : 'External Course'}</span>
            <span class="doc-badge" style="background:#fef3c7;color:#b45309;">${category}</span>
          </div>
          <h1 style="margin-top:8px;">${title}</h1>
          <p style="font-size:12px;color:#64748b;">Provider: ${provider} · Duration: ${duration}</p>
        </div>
        <div style="text-align:right;">
          <b style="font-size:14px;color:#111827;">Priority Handling Services, Inc.</b>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Workforce Learning & Development</div>
          <div style="font-size:10px;color:#94a3b8;">Printed: ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <small>Category</small>
          <b>${category}</b>
        </div>
        <div class="meta-item">
          <small>Duration</small>
          <b>${duration}</b>
        </div>
        <div class="meta-item">
          <small>Target Competency</small>
          <b>${competencies}</b>
        </div>
        <div class="meta-item">
          <small>Delivery</small>
          <b>${resource.provider_type === 'internal' ? 'Self-Paced / In-House' : 'Certified Provider'}</b>
        </div>
      </div>

      <div class="section-block">
        <h3>Course Overview</h3>
        <p>${description}</p>
      </div>

      ${objectives ? `
        <div class="section-block">
          <h3>Learning Objectives</h3>
          <ul class="objectives-list">${objectives}</ul>
        </div>
      ` : ''}

      <div class="section-block">
        <h3>Curriculum & Lesson Guide</h3>
        <div class="lesson-container">
          ${lessonHtml}
        </div>
      </div>

      <div class="signoff-box">
        <h4 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Course Completion & Assessment Sign-off</h4>
        <div class="signoff-grid">
          <div>
            <small style="font-size:11px;color:#64748b;">Learner Name & Signature</small>
            <div class="signoff-line"></div>
            <small style="font-size:10px;color:#94a3b8;">Date: _______________</small>
          </div>
          <div>
            <small style="font-size:11px;color:#64748b;">Supervisor / Trainer Verification</small>
            <div class="signoff-line"></div>
            <small style="font-size:10px;color:#94a3b8;">Result: [  ] Pass   [  ] Incomplete</small>
          </div>
        </div>
      </div>

      <div class="footer-note">
        Priority Handling Services, Inc. · Official Training Record
      </div>
    </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 400)
}

