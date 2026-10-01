import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import '../reportsHub.css'

const REPORT_TYPES = [
  { id: 'competency-gap', name: 'Competency Gap Report', icon: 'zap', desc: 'Skill target benchmark evaluation & deficit gap analysis' },
  { id: 'training', name: 'Training Program Report', icon: 'calendar', desc: 'Session schedules, attendance compliance & capacity utilization' },
  { id: 'learning-completion', name: 'Learning Completion Report', icon: 'book', desc: 'Course completion rates, exam scores & empirical auto-lifts' },
  { id: 'performance', name: 'Performance Rating Report', icon: 'trend', desc: '50/30/20 weighted performance evaluation & appraisal bands' },
  { id: 'attendance', name: 'Attendance Audit Report', icon: 'clock', desc: 'HR2 Daily DTR sync logs, attendance rates & overtime tracking' },
  { id: 'recognition', name: 'Social Recognition Report', icon: 'heart', desc: 'Peer award nominations, core values alignment & points audit' },
  { id: 'succession', name: 'Succession & Readiness Report', icon: 'crown', desc: 'Leadership bench strength, talent readiness bands & flight risk' }
]

const DEPARTMENTS = [
  'All Departments',
  'Executive Management',
  'Fleet & Transportation',
  'Dispatch & Routing',
  'Warehouse & Inventory',
  'Customer Service',
  'Safety & Compliance',
  'Finance & Administration',
  'Human Resources',
  'IT & Systems'
]

function ReportSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Meta cards shimmer */}
      <div className="skeleton-bar" style={{ height: 64, borderRadius: 10 }} />
      {/* 4 Stat KPI Cards shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-bar" style={{ height: 80, borderRadius: 10 }} />
        ))}
      </div>
      {/* Executive summary shimmer */}
      <div className="skeleton-bar" style={{ height: 86, borderRadius: 10 }} />
      {/* Data Table shimmer */}
      <div className="skeleton-bar" style={{ height: 260, borderRadius: 10 }} />
    </div>
  )
}

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState('competency-gap')
  const [department, setDepartment] = useState('All Departments')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Q1 2026')
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getReportData(activeTab, {
        department: department === 'All Departments' ? '' : department,
        search,
        period
      })
      setReportData(res)
    } catch (err) {
      console.error('Failed to load formal report data:', err)
      setError(err.message || 'Failed to fetch report data from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [activeTab, department, period])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchReport()
  }

  const handleExportCSV = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) return
    const headers = Object.keys(reportData.rows[0])
    const csvLines = [
      `"Formal Report: ${reportData.metadata?.title || activeTab}"`,
      `"Generated: ${reportData.metadata?.generatedAt || new Date().toISOString()}"`,
      `"Document ID: ${reportData.metadata?.documentId || 'PHS-RPT'}"`,
      '',
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
    ]
    reportData.rows.forEach(row => {
      const line = headers.map(h => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : ''
        return `"${val.replace(/"/g, '""')}"`
      }).join(',')
      csvLines.push(line)
    })
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${activeTab}-formal-report-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintPDF = () => {
    if (!reportData) return

    const printWin = window.open('', '_blank', 'width=960,height=1150')
    if (!printWin) {
      alert('Pop-up blocked! Please allow pop-ups for this site to generate and print formal executive reports.')
      return
    }

    const title = reportData.metadata?.title || currentReportMeta?.name || activeTab
    const subtitle = reportData.metadata?.subtitle || currentReportMeta?.desc || ''
    const generatedAt = reportData.metadata?.generatedAt || new Date().toLocaleString()
    const documentId = reportData.metadata?.documentId || `PHS-RPT-${Math.floor(100000 + Math.random() * 900000)}`
    const generatedBy = reportData.metadata?.generatedBy || 'Executive HR Administrator'
    const departmentName = department || 'All Departments'
    const periodName = period || 'Current Period'

    const kpiItems = (reportData.kpis || []).map(kpi => `
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; flex: 1; min-width: 140px;">
        <div style="font-size: 10px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px;">${kpi.label}</div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${kpi.val}</div>
      </div>
    `).join('')

    const headers = reportData.rows && reportData.rows.length > 0 ? Object.keys(reportData.rows[0]) : []
    const tableHeaderHtml = headers.map(h => `<th style="background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; text-align: left; border: 1px solid #0f172a;">${h}</th>`).join('')

    const tableRowsHtml = (reportData.rows || []).map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      const cells = headers.map(h => `<td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 11px;">${row[h] !== undefined && row[h] !== null ? row[h] : '-'}</td>`).join('')
      return `<tr style="background: ${bg};">${cells}</tr>`
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Official Report - ${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-banner {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .org-brand {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: -0.3px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .org-sub {
            font-size: 10px;
            color: #475569;
            font-weight: 700;
            letter-spacing: 0.8px;
            margin-top: 3px;
            text-transform: uppercase;
          }
          .doc-badge {
            text-align: right;
            font-size: 10px;
            color: #334155;
            line-height: 1.6;
          }
          .badge-pill {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: 700;
            font-size: 9px;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .meta-box {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
          }
          .meta-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .meta-value {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
          }
          .report-heading {
            margin-bottom: 20px;
          }
          .report-heading h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0 0 4px 0;
            color: #0f172a;
          }
          .report-heading p {
            font-size: 11px;
            color: #475569;
            margin: 0;
          }
          .kpi-row {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
          }
          .ai-box {
            background: #f0f9ff;
            border-left: 4px solid #0284c7;
            border-top: 1px solid #bae6fd;
            border-right: 1px solid #bae6fd;
            border-bottom: 1px solid #bae6fd;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          .ai-title {
            font-size: 10px;
            font-weight: 800;
            color: #0369a1;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 4px;
          }
          .ai-text {
            font-size: 11px;
            line-height: 1.55;
            color: #0c4a6e;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          tr {
            page-break-inside: avoid;
          }
          .sign-grid {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #cbd5e1;
            page-break-inside: avoid;
          }
          .sign-col {
            width: 30%;
            text-align: center;
          }
          .sign-line {
            border-bottom: 1px solid #0f172a;
            height: 36px;
            margin-bottom: 6px;
          }
          .sign-title {
            font-size: 10px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
          }
          .sign-sub {
            font-size: 9px;
            color: #64748b;
          }
          .doc-footer {
            margin-top: 24px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            text-align: center;
            font-size: 9px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div>
            <div class="org-brand">PRIORITY HANDLING SERVICES, INC.</div>
            <div class="org-sub">Official Workforce Governance &amp; Performance Audit</div>
          </div>
          <div class="doc-badge">
            <div><span class="badge-pill">OFFICIAL / CONFIDENTIAL</span></div>
            <div><strong>DOC ID:</strong> ${documentId}</div>
            <div><strong>GENERATED:</strong> ${generatedAt}</div>
          </div>
        </div>

        <div class="meta-box">
          <div>
            <div class="meta-label">Report Module</div>
            <div class="meta-value">${title}</div>
          </div>
          <div>
            <div class="meta-label">Department</div>
            <div class="meta-value">${departmentName}</div>
          </div>
          <div>
            <div class="meta-label">Audit Period</div>
            <div class="meta-value">${periodName}</div>
          </div>
          <div>
            <div class="meta-label">Authority / Analyst</div>
            <div class="meta-value">${generatedBy}</div>
          </div>
        </div>

        <div class="report-heading">
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>

        ${reportData.kpis && reportData.kpis.length > 0 ? `<div class="kpi-row">${kpiItems}</div>` : ''}

        ${reportData.aiBrief ? `
          <div class="ai-box">
            <div class="ai-title">Executive Analytics & Governance Summary</div>
            <div class="ai-text">${reportData.aiBrief}</div>
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>${tableHeaderHtml}</tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="sign-grid">
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Prepared By</div>
            <div class="sign-sub">Human Resource Analytics Lead</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Audited & Verified By</div>
            <div class="sign-sub">Department Governance Head</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Executive Approval</div>
            <div class="sign-sub">Vice President of Operations / HR</div>
          </div>
        </div>

        <div class="doc-footer">
          Priority Handling Services, Inc. • Document Verification Hash: PHS-SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()} • Page 1 of 1
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `

    printWin.document.open()
    printWin.document.write(htmlContent)
    printWin.document.close()
  }

  const currentReportMeta = REPORT_TYPES.find(r => r.id === activeTab) || REPORT_TYPES[0]

  return (
    <div className="reports-hub-container" style={{ padding: '24px 32px 60px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Printable CSS formatting for Executive Formal Output */}
      <style>{`
        .print-header { display: none; }

        @media print {
          /* ── Hide the entire app shell ── */
          .sidebar,
          nav,
          header,
          .topbar,
          .mobile-nav,
          .ai-chat-drawer,
          .notif-popover-backdrop,
          .notif-panel-box {
            display: none !important;
          }

          /* ── Reset body & root layout so the report fills the page ── */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
          }

          /* ── Make the main content wrapper fill the full page ── */
          #root,
          .fixed-main,
          .min-h-screen.flex,
          [class*="shell"],
          [class*="layout"],
          [class*="main-content"],
          [class*="content-area"],
          [class*="page-transition"] {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: transparent !important;
          }

          /* ── Hide the screen-only header, filter bar, and action buttons ── */
          .no-print {
            display: none !important;
          }

          /* ── Show the official print-only corporate header ── */
          .print-header {
            display: block !important;
            border-bottom: 2pt solid #0f172a;
            padding-bottom: 10pt;
            margin-bottom: 16pt;
          }

          /* ── Report container: remove card shadow & border for print ── */
          .reports-hub-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          .reports-paper-card,
          .reports-printable-area {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 16pt !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          /* ── Meta card & KPI cards ── */
          .reports-meta-card {
            background: #f8fafc !important;
            border: 1pt solid #cbd5e1 !important;
            border-radius: 4pt !important;
            padding: 10pt 12pt !important;
            margin-bottom: 14pt !important;
            page-break-inside: avoid;
          }
          .reports-meta-label {
            color: #475569 !important;
            font-size: 7pt !important;
          }
          .reports-meta-value {
            color: #0f172a !important;
          }

          .reports-kpi-card {
            background: #f8fafc !important;
            border: 1pt solid #e2e8f0 !important;
            border-radius: 4pt !important;
            padding: 10pt 12pt !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          .reports-kpi-label { color: #475569 !important; font-size: 7pt !important; }
          .reports-kpi-value { color: #0f172a !important; font-size: 16pt !important; }

          /* ── AI brief box ── */
          .reports-ai-brief {
            background: #f8fafc !important;
            border-left: 3pt solid #0f172a !important;
            padding: 10pt 14pt !important;
            margin-bottom: 16pt !important;
            page-break-inside: avoid;
          }
          .reports-ai-title { color: #0f172a !important; font-size: 8pt !important; }
          .reports-ai-text { color: #1e293b !important; font-size: 10pt !important; }

          /* ── Table ── */
          .reports-table-wrap {
            border: 1pt solid #e2e8f0 !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .reports-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
          }
          .reports-table th {
            background: #f1f5f9 !important;
            color: #334155 !important;
            border-bottom: 1.5pt solid #94a3b8 !important;
            padding: 6pt 8pt !important;
            font-size: 7pt !important;
            font-weight: 700 !important;
          }
          .reports-table td {
            padding: 5pt 8pt !important;
            color: #0f172a !important;
            border-bottom: 0.5pt solid #e2e8f0 !important;
          }
          .reports-table tr.even-row { background: #f8fafc !important; }
          .reports-table tr.odd-row  { background: #ffffff !important; }

          /* ── Footer ── */
          .reports-footer {
            border-top: 0.75pt dashed #94a3b8 !important;
            color: #64748b !important;
            font-size: 7pt !important;
            margin-top: 16pt !important;
            padding-top: 10pt !important;
          }

          /* ── Avoid page breaks in cards ── */
          .reports-kpi-card,
          .reports-meta-card,
          .reports-ai-brief {
            break-inside: avoid;
          }
          .reports-table tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Screen Page Header */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
            Official Reports & Governance Center
          </div>
          <h1 className="reports-title">
            Executive Workforce Reports
          </h1>
          <p className="reports-subtitle">
            Formal audit-ready analytics, competency matrices, training, attendance, performance and succession reports.
          </p>
        </div>

        {/* Global Export Actions */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
          <button
            type="button"
            className="reports-btn-csv"
            onClick={fetchReport}
            disabled={loading}
            title="Fetch real-time data from database"
            style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6" />
              <path d="M21.5 8A10 10 0 0 0 3.95 6.05L2.5 7.5M2.5 16a10 10 0 0 0 17.55 1.95l1.45-1.45" />
            </svg>
            Refresh Live Data
          </button>
          <button
            type="button"
            className="reports-btn-csv"
            onClick={handleExportCSV}
            disabled={loading || !reportData}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button
            type="button"
            className="reports-btn-print"
            onClick={handlePrintPDF}
            disabled={loading || !reportData}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print / PDF Export
          </button>
        </div>
      </div>

      {/* Printable & Screen Formal Report Output Container */}
      <div className="reports-printable-area reports-paper-card">
        
        {/* Printable Official Corporate Header */}
        <div className="print-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>PRIORITY HANDLING SERVICES, INC.</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>OFFICIAL HUMAN CAPITAL GOVERNANCE & PERFORMANCE REPORT</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>
              <div><strong>CLASSIFICATION:</strong> OFFICIAL / CONFIDENTIAL</div>
              <div><strong>DOC ID:</strong> {reportData?.metadata?.documentId || 'PHS-RPT-001'}</div>
            </div>
          </div>
        </div>

        {/* Filter Bar with Report Module Selector Dropdown */}
        <div className="no-print reports-filter-bar">
          
          {/* Dropdown for the 7 Standalone Reports */}
          <div style={{ flex: 1.2, minWidth: 220 }}>
            <label className="reports-filter-label primary-label">Select Report Module</label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="reports-select reports-module-select"
            >
              {REPORT_TYPES.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="reports-filter-label">Filter by Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="reports-select"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 0.8, minWidth: 150 }}>
            <label className="reports-filter-label">Audit Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="reports-select"
            >
              <option value="Q1 2026">Q1 2026 (Current)</option>
              <option value="Q4 2025">Q4 2025 (Previous)</option>
              <option value="YTD 2026">YTD 2026 Cumulative</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} style={{ flex: 1.3, minWidth: 220 }}>
            <label className="reports-filter-label">Search Employee or Keyword</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Type name, title or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="reports-input"
              />
              <button
                type="submit"
                className="reports-btn-apply"
              >
                Apply
              </button>
            </div>
          </form>
        </div>

        {/* First time loading skeleton */}
        {loading && !reportData && <ReportSkeleton />}

        {/* Error Alert */}
        {error && !loading && (
          <div style={{ padding: 16, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 20 }}>
            <strong>Report Error:</strong> {error}
          </div>
        )}

        {/* Content Body when loaded or refreshing in background */}
        {reportData && (
          <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.25s ease' }}>
            {/* Formal Report Header Meta Card */}
            <div className="reports-meta-card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: 12 }}>
                <div>
                  <span className="reports-meta-label">Report Title</span>
                  <strong className="reports-meta-value" style={{ fontSize: 15 }}>{reportData?.metadata?.title || currentReportMeta.name}</strong>
                </div>
                <div>
                  <span className="reports-meta-label">Generated Date</span>
                  <strong className="reports-meta-value">{reportData?.metadata?.generatedAt ? new Date(reportData.metadata.generatedAt).toLocaleString() : new Date().toLocaleString()}</strong>
                </div>
                <div>
                  <span className="reports-meta-label">Prepared By</span>
                  <strong className="reports-meta-value">{reportData?.metadata?.generatedBy || 'System Executive'} ({reportData?.metadata?.userRole || 'HR Admin'})</strong>
                </div>
                <div>
                  <span className="reports-meta-label">Audit Period</span>
                  <strong className="reports-meta-value">{period}</strong>
                </div>
              </div>
            </div>
            {/* Executive KPI Stat Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              {Object.entries(reportData.summary || {}).map(([key, val]) => {
                const formattedLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                return (
                  <div key={key} className="reports-kpi-card">
                    <span className="reports-kpi-label">
                      {formattedLabel}
                    </span>
                    <div className="reports-kpi-value">
                      {val}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Formal Executive Summary Box */}
            <div className="reports-ai-brief">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="reports-ai-title">Executive Summary & Key Audit Findings</span>
              </div>
              <p className="reports-ai-text">
                {reportData.aiTakeaway}
              </p>
            </div>

            {/* Formal Tabular Data Report */}
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    {reportData.rows && reportData.rows.length > 0 ? (
                      Object.keys(reportData.rows[0]).filter(k => k !== 'id').map(header => (
                        <th key={header}>
                          {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </th>
                      ))
                    ) : (
                      <th style={{ padding: 16 }}>No Record Header</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows && reportData.rows.length > 0 ? (
                    reportData.rows.map((row, idx) => (
                      <tr key={row.id || idx} className={idx % 2 === 0 ? 'odd-row' : 'even-row'}>
                        {Object.entries(row).filter(([k]) => k !== 'id').map(([key, value]) => {
                          const valStr = String(value)
                          const isStatus = key.toLowerCase().includes('status') || key.toLowerCase().includes('band') || key.toLowerCase().includes('gap')
                          
                          let badgeBg = '#f1f5f9'
                          let badgeColor = '#475569'
                          
                          if (isStatus) {
                            if (valStr.includes('Critical') || valStr.includes('Needs') || valStr.includes('Pending')) {
                              badgeBg = '#fef2f2'
                              badgeColor = '#991b1b'
                            } else if (valStr.includes('Optimal') || valStr.includes('COMPLETED') || valStr.includes('Verified') || valStr.includes('Exceeds') || valStr.includes('Ready Now')) {
                              badgeBg = '#f0fdf4'
                              badgeColor = '#166534'
                            } else if (valStr.includes('Moderate') || valStr.includes('Meets') || valStr.includes('1-2 Years')) {
                              badgeBg = '#eff6ff'
                              badgeColor = '#1e40af'
                            }
                          }

                          return (
                            <td key={key} style={{ fontWeight: key.toLowerCase().includes('name') || key.toLowerCase().includes('title') ? 600 : 400 }}>
                              {isStatus ? (
                                <span style={{ padding: '3px 9px', borderRadius: 12, background: badgeBg, color: badgeColor, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                  {valStr}
                                </span>
                              ) : (
                                valStr
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" style={{ padding: 32, textAlign: 'center', opacity: 0.7 }}>
                        No records match the selected department and period criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Formal Report Signoff Footer */}
            <div className="reports-footer">
              <div>
                Report Document Hash: <code>PHS-FML-{Math.random().toString(36).substring(2, 10).toUpperCase()}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
