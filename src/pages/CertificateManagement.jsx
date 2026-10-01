import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import useDialogFocus from '../hooks/useDialogFocus'
import { api } from '../lib/api'
import QRCodeImage from '../components/QRCodeImage'
import ESignaturePad from '../components/ESignaturePad'
import { CheckCircle, AlertTriangle, Pencil, Trash2, X, Award } from 'lucide-react'
import PageBanner from '../components/PageBanner'

const defaults = { name: 'Employee of the Month', certificateTitle: 'Certificate of Excellence', subtitle: 'Employee of the Month', organizationName: 'Priority Handling Services, Inc.', bodyText: 'This certificate is proudly awarded to {{employee_name}} in recognition of outstanding contribution and excellence.', signatoryName: 'Ava Reyes', signatoryPosition: 'HR Business Partner', validityDays: '' }
const date = value => value ? new Date(value).toLocaleDateString() : '—'

// Compress user-uploaded logos and signatures on canvas to avoid multi-megabyte payloads
const compressImage = (file, maxWidth = 500, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxWidth) / height)
            height = maxWidth
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mimeType, quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Page-level cache so switching away and back is instant
const certCache = { certificates: null, templates: null, employees: null, ts: 0 }
const CACHE_TTL_MS = 60_000 // 1 minute

function Preview({ template, certificate, compact = false }) {
  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')
  const name = certificate?.employee_name || '{{Employee Name}}'
  const text = (certificate?.achievement_text || template?.body_text || defaults.bodyText).replaceAll('{{employee_name}}', name)
  const verifyCode = certificate?.verification_code || certificate?.id || certificate?.certificate_number
  const verifyUrl = verifyCode ? `${publicAppUrl}/verify/certificate/${verifyCode}` : `${publicAppUrl}/verify/certificate/SAMPLE-VERIFICATION-CODE`

  return (
    <article className={`certificate-preview ${compact ? 'compact' : ''}`}>
      {template?.logo_url && <img className="certificate-logo" src={template.logo_url} alt="Organization logo"/>}
      <img className="certificate-seal-logo" src="/prioritylogo.png" alt="Priority Handling Services, Inc." />
      <small>{template?.organization_name || certificate?.organization_name || 'Priority Handling Services, Inc.'}</small>
      <h2>{template?.certificate_title || certificate?.certificate_title || 'Certificate of Excellence'}</h2>
      <em>{template?.subtitle || certificate?.subtitle || 'Recognition of achievement'}</em>
      <p>This certificate is presented to</p>
      <h1>{name}</h1>
      <div className="certificate-rule"/>
      <p className="certificate-body">{text}</p>
      <div className="certificate-foot">
        <span>Date awarded<br/><b>{date(certificate?.awarded_at)}</b></span>
        <span className="certificate-qr">
          <QRCodeImage value={verifyUrl} size={compact ? 70 : 90} />
          <small>VERIFY ONLINE</small>
        </span>
        <span>
          {template?.signature_url && <img className="certificate-signature" src={template.signature_url} alt="Authorized signature"/>}
          Authorized by<br/><b>{template?.signatory_name || certificate?.signatory_name || 'Authorized signatory'}</b>
        </span>
      </div>
      <footer>Certificate No. {certificate?.certificate_number || 'PHS-YYYY-00000000'}{verifyCode ? ` · Code: ${verifyCode}` : ''}</footer>
    </article>
  )
}

export default function CertificateManagement({ embedded = false }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const hr = role === 'hr'
  const operationsManager = role === 'operations_manager'
  const Container = embedded ? 'section' : 'main'

  const [templates, setTemplates] = useState(certCache.templates || [])
  const [certificates, setCertificates] = useState(certCache.certificates || [])
  const [employees, setEmployees] = useState(certCache.employees || [])
  const [template, setTemplate] = useState(null)
  const [recipientIds, setRecipientIds] = useState([])
  const [achievement, setAchievement] = useState('For exceptional performance and meaningful contribution to the organization.')
  const [form, setForm] = useState(defaults)
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [saving, setSaving] = useState(false)
  const [retiring, setRetiring] = useState(null)
  const [activeStep, setActiveStep] = useState(0)
  // Only show full skeleton on very first load (no cache). Subsequent loads show stale data instantly.
  const [loading, setLoading] = useState(certCache.certificates === null)
  const [hrLoading, setHrLoading] = useState(hr && certCache.templates === null)

  const load = async (force = false) => {
    const cacheValid = !force && Date.now() - certCache.ts < CACHE_TTL_MS
    if (cacheValid && certCache.certificates !== null) return

    try {
      // Fire certificates fetch immediately — show as soon as it arrives
      const certPromise = api.certificates()

      if (hr) {
        // Fire HR calls in parallel but don't block certificate display
        const [certResult, templatesResult, employeesResult] = await Promise.all([
          certPromise,
          api.certificateTemplates(),
          api.workflowSubjects(),
        ])
        const certs = certResult.certificates || []
        const tmps = templatesResult.templates || []
        const emps = employeesResult.employees || []
        certCache.certificates = certs
        certCache.templates = tmps
        certCache.employees = emps
        certCache.ts = Date.now()
        setCertificates(certs)
        setTemplates(tmps)
        setEmployees(emps)
        setTemplate(t => t ?? (tmps[0] || null))
        setHrLoading(false)
      } else {
        const certResult = await certPromise
        const certs = certResult.certificates || []
        certCache.certificates = certs
        certCache.ts = Date.now()
        setCertificates(certs)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
      setHrLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const recipients = employees.filter(person => recipientIds.includes(person.id))
  const filtered = useMemo(() => {
    const matched = certificates.filter(c => `${c.employee_name} ${c.certificate_title} ${c.status} ${c.certificate_number || ''} ${c.verification_code || ''}`.toLowerCase().includes(query.toLowerCase()))
    switch (sortBy) {
      case 'oldest': return [...matched].sort((a, b) => new Date(a.issued_at || a.awarded_at || 0) - new Date(b.issued_at || b.awarded_at || 0))
      case 'name': return [...matched].sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''))
      case 'status': return [...matched].sort((a, b) => (a.status || '').localeCompare(b.status || ''))
      case 'newest':
      default: return [...matched].sort((a, b) => new Date(b.issued_at || b.awarded_at || 0) - new Date(a.issued_at || a.awarded_at || 0))
    }
  }, [certificates, query, sortBy])

  const modalRef = useDialogFocus(showForm, () => setShowForm(false))

  const upload = async (field, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please select an image file.')
    if (file.size > 8 * 1024 * 1024) return setError('Image must be smaller than 8 MB.')
    try {
      const compressed = await compressImage(file, 500, 0.85)
      setForm(current => ({ ...current, [field]: compressed, [`${field}Name`]: file.name }))
    } catch {
      setError('Failed to process image file. Please try a different image.')
    }
  }

  const save = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const data = { ...form, validityDays: form.validityDays ? Number(form.validityDays) : null }
      const result = editingTemplate
        ? await api.updateCertificateTemplate(editingTemplate.id, data)
        : await api.createCertificateTemplate(data)
      setTemplates(items =>
        editingTemplate
          ? items.map(item => item.id === result.template.id ? result.template : item)
          : [result.template, ...items]
      )
      setTemplate(result.template)
      setShowForm(false)
      setEditingTemplate(null)
      setNotice(editingTemplate ? 'Certificate template updated.' : 'Certificate template saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const editTemplate = (t) => {
    const target = t || template
    if (!target) return setError('Select a template to edit.')
    setForm({
      name: target.name,
      certificateTitle: target.certificate_title,
      subtitle: target.subtitle || '',
      organizationName: target.organization_name,
      bodyText: target.body_text,
      signatoryName: target.signatory_name,
      signatoryPosition: target.signatory_position || '',
      validityDays: target.validity_days || '',
      logoUrl: target.logo_url || '',
      signatureUrl: target.signature_url || ''
    })
    setEditingTemplate(target)
    setShowForm(true)
  }

  const retireTemplate = async (t) => {
    const target = t || template
    if (!target) return setError('Select a template to retire.')
    if (!window.confirm(`Retire "${target.name}"? Issued certificates will remain available.`)) return
    setError('')
    setNotice('')
    setRetiring(target.id)
    try {
      await api.retireCertificateTemplate(target.id)
      setTemplates(items => {
        const remaining = items.filter(item => item.id !== target.id)
        if (template?.id === target.id) {
          setTemplate(remaining[0] || null)
        }
        return remaining
      })
      setNotice(`Certificate template "${target.name}" retired.`)
    } catch (requestError) {
      setError(requestError.message || 'Failed to retire certificate template. Please try again.')
    } finally {
      setRetiring(null)
    }
  }

  const issue = async () => {
    if (!template || !recipientIds.length) return setError('Select a template and at least one employee.')
    if (!window.confirm(`Generate ${recipientIds.length} certificate(s)?`)) return
    setError('')
    try {
      await api.issueCertificates({ templateId: template.id, employeeIds: recipientIds, achievementText: achievement, awardedAt: new Date().toISOString().slice(0, 10) })
      setNotice('Certificates generated and archived.')
      setRecipientIds([])
      setActiveStep(0)
      certCache.ts = 0 // bust cache
      await load(true)
    } catch (requestError) { setError(requestError.message) }
  }

  const revoke = async certificate => {
    const reason = window.prompt('Reason for revoking this certificate (min 3 characters):')
    if (!reason) return
    if (reason.trim().length < 3) return setError('Revoke reason must be at least 3 characters.')
    try { await api.revokeCertificate(certificate.id, reason.trim()); certCache.ts = 0; await load(true) } catch (requestError) { setError(requestError.message) }
  }

  const checkExpiry = async () => {
    try {
      const result = await api.checkExpiredCertificates()
      if (result.expired > 0) { certCache.ts = 0; await load(true); setNotice(`${result.expired} expired certificate(s) updated.`) }
      else { setNotice('No expired certificates found.') }
    } catch (requestError) { setError(requestError.message) }
  }

  const archiveControls = (
    <div className="certificate-archive-tools">
      {hr && <button className="certificate-expiry-btn" onClick={checkExpiry} title="Mark expired certificates">Expire outdated</button>}
      <label className="certificate-search-label">
        <input className="certificate-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search certificates or verification code…" aria-label="Search certificates"/>
        {query && <button className="certificate-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
      </label>
      <label className="certificate-sort-label">Sort
        <select className="certificate-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort certificates">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">By employee</option>
          <option value="status">By status</option>
        </select>
      </label>
    </div>
  )

  const printOrDownloadCertificate = async (certificate) => {
    const tmpl = templates.find(t => t.id === certificate?.template_id) || certificate || {}
    const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')
    const verifyCode = certificate?.verification_code || certificate?.id || certificate?.certificate_number
    const verifyUrl = verifyCode ? `${publicAppUrl}/verify/certificate/${verifyCode}` : `${publicAppUrl}/verify/certificate/SAMPLE-VERIFICATION-CODE`

    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 220,
        color: { dark: '#282631', light: '#ffffff' }
      })
    } catch {
      qrDataUrl = ''
    }

    const orgName = tmpl?.organization_name || certificate?.organization_name || 'Priority Handling Services, Inc.'
    const title = tmpl?.certificate_title || certificate?.certificate_title || 'Certificate of Excellence'
    const subtitle = tmpl?.subtitle || certificate?.subtitle || 'Recognition of achievement'
    const empName = certificate?.employee_name || '{{Employee Name}}'
    const bodyText = (certificate?.achievement_text || tmpl?.body_text || defaults.bodyText).replaceAll('{{employee_name}}', empName)
    const awardedDate = date(certificate?.awarded_at || certificate?.issued_at)
    const signatory = tmpl?.signatory_name || certificate?.signatory_name || 'Authorized Signatory'
    const signatoryPos = tmpl?.signatory_position || certificate?.signatory_position || ''
    const certNum = certificate?.certificate_number || 'PHS-YYYY-00000000'
    const logoHtml = tmpl?.logo_url ? `<img src="${tmpl.logo_url}" class="logo" alt="Logo" />` : ''
    const sigHtml = tmpl?.signature_url ? `<img src="${tmpl.signature_url}" class="sig" alt="Signature" />` : ''

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title} - ${empName}</title>
<style>
  @page { size: landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #fcfbff; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; }
  .cert-container { width: 100vw; height: 100vh; padding: 44px 56px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #fcfbff 0%, #f4f0ff 100%); border: 3px solid #111827; box-sizing: border-box; position: relative; }
  .logo { position: absolute; left: 44px; top: 40px; max-width: 100px; max-height: 70px; object-fit: contain; }
  .seal-logo { position: absolute; right: 44px; top: 40px; width: 64px; height: 64px; object-fit: contain; background: #fff; border: 1px solid #e2e8f0; border-radius: 5px; }
  .org { font-size: 13px; color: #7c778a; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
  h2 { font-size: 32px; color: #282631; letter-spacing: -0.5px; font-weight: 800; margin-bottom: 4px; }
  em { font-size: 16px; color: #111827; font-style: normal; font-weight: 600; }
  .pres-text { font-size: 14px; color: #7c778a; margin: 20px 0 6px; }
  h1 { font-size: 38px; color: #111827; font-weight: 800; letter-spacing: -0.5px; }
  .rule { width: 100px; height: 3px; background: linear-gradient(90deg, #111827, #9b89f5); margin: 10px auto 14px; border-radius: 2px; }
  .body { font-size: 15px; line-height: 1.65; color: #4a4656; max-width: 700px; margin: 0 auto; }
  .foot { width: 85%; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; font-size: 13px; color: #7c778a; text-align: left; }
  .foot b { display: block; color: #282631; font-size: 14px; font-weight: 700; margin-top: 3px; }
  .foot small { display: block; font-size: 11px; color: #888; margin-top: 1px; }
  .qr { text-align: center; display: flex; flex-direction: column; align-items: center; }
  .qr img { width: 95px; height: 95px; border-radius: 4px; border: 1px solid #e5e7eb; background: #fff; }
  .qr small { font-size: 8.5px; color: #111827; font-weight: 700; letter-spacing: 0.5px; margin-top: 3px; }
  .sig { display: block; max-width: 140px; max-height: 48px; object-fit: contain; margin-bottom: 4px; }
  footer { position: absolute; bottom: 16px; width: 100%; text-align: center; font-size: 11px; color: #9b97a6; letter-spacing: 0.5px; }
</style>
</head>
<body>
<div class="cert-container">
  ${logoHtml}
  <img class="seal-logo" src="/prioritylogo.png" alt="Priority Handling Services, Inc." />
  <div class="org">${orgName}</div>
  <h2>${title}</h2>
  <em>${subtitle}</em>
  <p class="pres-text">This certificate is proudly presented to</p>
  <h1>${empName}</h1>
  <div class="rule"></div>
  <p class="body">${bodyText}</p>
  <div class="foot">
    <div>Date awarded<br><b>${awardedDate}</b></div>
    <div class="qr">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ''}
      <small>VERIFY ONLINE</small>
    </div>
    <div>
      ${sigHtml}
      Authorized by<br><b>${signatory}</b><small>${signatoryPos}</small>
    </div>
  </div>
  <footer>Certificate No. ${certNum}${verifyCode ? ` · Code: ${verifyCode}` : ''}</footer>
</div>
</body>
</html>`)
    doc.close()

    iframe.contentWindow.focus()
    setTimeout(() => {
      try {
        iframe.contentWindow.print()
      } catch (err) {
        console.error('Print failed:', err)
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe)
          }
        }, 1500)
      }
    }, 60)
  }

  const print = (certificate) => {
    printOrDownloadCertificate(certificate)
  }

  const downloadPdf = (certificate) => {
    printOrDownloadCertificate(certificate)
  }

  const copyVerificationLink = certificate => {
    const code = certificate?.verification_code || certificate?.id || certificate?.certificate_number
    if (!code) return setError('Certificate verification code is missing.')
    const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')
    const url = `${publicAppUrl}/verify/certificate/${code}`
    navigator.clipboard.writeText(url)
    setNotice(`Copied verification link: ${url}`)
  }

  const verifyCertificate = async certificate => {
    const code = certificate?.verification_code || certificate?.id || certificate?.certificate_number
    if (!code) return setError('This certificate has no verification code.')
    window.open(`/verify/certificate/${code}`, '_blank')
  }

  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 8

  useEffect(() => { setCurrentPage(1) }, [query, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paginatedCertificates = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const gallery = (
    <>
      <div className="certificate-gallery">
        {loading ? (
          [1, 2, 3, 4].map(n => (
            <article className="certificate-card" key={n} style={{ minHeight: 220, opacity: 0.6 }}>
              <div className="skeleton-bar" style={{ height: 130, borderRadius: 8, marginBottom: 12 }} />
              <div className="skeleton-bar" style={{ height: 14, width: '70%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-bar" style={{ height: 10, width: '45%', borderRadius: 4 }} />
            </article>
          ))
        ) : paginatedCertificates.length > 0 ? (
          paginatedCertificates.map(c => (
            <article className="certificate-card" key={c.id}>
              <Preview certificate={c} template={templates.find(t => t.id === c.template_id)} compact/>
              <div>
                <span className={`certificate-status ${c.status}`}>{c.status}</span>
                <h3>{hr ? c.employee_name : c.certificate_title}</h3>
                <p>{c.certificate_number || date(c.awarded_at)}</p>
                <p style={{fontSize:'8px', color:'#111827', margin:'2px 0 6px', fontFamily:'monospace'}}>Code: {c.verification_code || 'N/A'}</p>
                <button onClick={() => print(c)}>Print</button>
                <button className="certificate-download-btn" onClick={() => downloadPdf(c)}>Download PDF</button>
                <button type="button" className="certificate-download-btn" onClick={() => copyVerificationLink(c)}>Copy Link</button>
                {hr && c.status === 'issued' && (
                  <>
                    <button onClick={() => api.regenerateCertificate(c.id).then(() => { certCache.ts = 0; load(true) })}>Regenerate</button>
                    <button className="certificate-revoke" onClick={() => revoke(c)}>Revoke</button>
                  </>
                )}
                <button className="certificate-verify-btn" onClick={() => verifyCertificate(c)}>Verify Page</button>
              </div>
            </article>
          ))
        ) : (
          <div className="certificate-empty">No certificates {query ? 'match your search' : 'yet'}.</div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="certificate-pagination">
          <span className="pagination-summary">
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} certificates
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="pagination-curr">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  )

  const employeeSearch = (
    <div className="certificate-employee-search">
      <input className="certificate-search" value={employeeQuery} onChange={e => setEmployeeQuery(e.target.value)} placeholder="Search employee name, role, or department" aria-label="Search employees"/>
      {employeeQuery && <button className="certificate-clear" type="button" onClick={() => setEmployeeQuery('')} aria-label="Clear employee search">×</button>}
    </div>
  )

  const openCreateForm = () => {
    setEditingTemplate(null)
    setForm(defaults)
    setError('')
    setShowForm(true)
  }

  if (!hr) return (
    <Container className={`certificate-workspace${embedded ? ' embedded' : ''}`}>
      <PageBanner
        title={operationsManager ? 'Certificate Management' : 'My Certificates'}
        description={operationsManager ? 'Review issued employee certificates and recognition records across the operation.' : 'View, print, or save certificates earned through Priority Handling Services, Inc.'}
        icon={<Award className="w-5 h-5 text-white" />}
      />
      <section className="certificate-archive">
        <div className="certificate-archive-inner"><h2>Issued certificates</h2>{archiveControls}</div>
        {gallery}
      </section>
    </Container>
  )

  return (
    <Container className={`certificate-workspace${embedded ? ' embedded' : ''}`}>
      <PageBanner
        title="Certificate Management"
        description="Create trusted recognition and achievement certificates from a guided issuance workflow."
        icon={<Award className="w-5 h-5 text-white" />}
        actions={
          <button className="saas-btn-primary" onClick={openCreateForm} style={{ background: '#111827', color: '#ffffff', border: 'none', fontWeight: 600, boxShadow: '0 2px 8px rgba(17,24,39,0.35)' }}>
            + Create template
          </button>
        }
      />

      {notice && <p className="certificate-notice"><CheckCircle className="inline w-4 h-4 mr-1 text-emerald-500" /> {notice}</p>}
      {error && <p className="certificate-error"><AlertTriangle className="inline w-4 h-4 mr-1 text-amber-500" /> {error}</p>}

      <section className="certificate-issue">
        <div className="certificate-controls">

          {/* ── Stepper header ── */}
          <div className="cert-stepper">
            {[
              { n: 1, label: 'Select Template',   sub: 'Choose design & signatory' },
              { n: 2, label: 'Select Employees',  sub: 'Pick certificate recipients' },
              { n: 3, label: 'Review & Issue',    sub: 'Confirm and generate' },
            ].map(({ n, label, sub }, i) => {
              const done   = activeStep > i
              const active = activeStep === i
              return (
                <button
                  key={n}
                  type="button"
                  className={`cert-step${active ? ' active' : ''}${done ? ' done' : ''}`}
                  onClick={() => setActiveStep(i)}
                >
                  <span className="cert-step-circle">{done ? '✓' : n}</span>
                  <span className="cert-step-text">
                    <b>{label}</b>
                    <small>{sub}</small>
                  </span>
                  {i < 2 && <span className="cert-step-line" />}
                </button>
              )
            })}
          </div>

          {/* ── Step 1 — Template Selection ── */}
          {activeStep === 0 && (
            <div className="certificate-section">
              <div className="template-grid">
                {loading ? (
                  [1, 2, 3].map(n => (
                    <div className="template-card" key={n} style={{ minHeight: 280, opacity: 0.6 }}>
                      <div className="skeleton-bar" style={{ height: 210, borderRadius: 6, marginBottom: 8 }} />
                      <div className="skeleton-bar" style={{ height: 12, width: '60%', borderRadius: 4 }} />
                    </div>
                  ))
                ) : (
                  <>
                    {templates.map(item => (
                      <div
                        className={`template-card ${template?.id === item.id ? 'selected' : ''}`}
                        key={item.id}
                        onClick={() => { setTemplate(item); setActiveStep(1) }}
                      >
                        <div className="template-card-preview">
                          <Preview template={item} compact/>
                        </div>
                        <div className="template-card-footer">
                          <b title={item.name}>{item.name}</b>
                          <div className="template-card-actions">
                            <button
                              type="button"
                              className="tmpl-btn edit"
                              title="Edit template"
                              onClick={(e) => { e.stopPropagation(); setTemplate(item); editTemplate(item) }}
                            >
                              <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit
                            </button>
                            <button
                              type="button"
                              className="tmpl-btn delete"
                              title="Retire template"
                              disabled={retiring === item.id}
                              onClick={(e) => { e.stopPropagation(); retireTemplate(item) }}
                            >
                              {retiring === item.id ? '…' : <><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Retire</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="template-card create" onClick={openCreateForm}>+ Create template</button>
                  </>
                )}
              </div>
              {template && (
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="certificate-primary" onClick={() => setActiveStep(1)}>
                    Next: Select employees →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2 — Employee Selection ── */}
          {activeStep === 1 && (
            <div className="certificate-section">
              {employeeSearch}
              {employees.filter(p => `${p.full_name} ${p.department} ${p.job_title}`.toLowerCase().includes(employeeQuery.toLowerCase())).map(p => (
                <label className="recipient-row" key={p.id}>
                  <input type="checkbox" checked={recipientIds.includes(p.id)} onChange={() => setRecipientIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])}/>
                  <span>{p.full_name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>
                  <div><b>{p.full_name}</b><small>{p.job_title} · {p.department}</small></div>
                </label>
              ))}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
                <button className="cert-step-back-btn" type="button" onClick={() => setActiveStep(0)}>← Back</button>
                {recipientIds.length > 0 && (
                  <button className="certificate-primary" onClick={() => setActiveStep(2)}>
                    Next: Review & issue →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3 — Review & Issue ── */}
          {activeStep === 2 && (
            <div className="certificate-section">
              <textarea value={achievement} onChange={e => setAchievement(e.target.value)}/>
              <div className="review-recipients">
                {recipients.map(p => <span key={p.id}>{p.full_name}</span>)}
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
                <button className="cert-step-back-btn" type="button" onClick={() => setActiveStep(1)}>← Back</button>
                <button className="certificate-primary" onClick={issue}>Generate certificates</button>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <aside className="certificate-preview-panel">
          <p>Live certificate preview</p>
          <Preview
            template={template}
            certificate={recipients[0] ? { employee_name: recipients[0].full_name, achievement_text: achievement, awarded_at: new Date().toISOString().slice(0, 10) } : null}
          />
        </aside>
      </section>

      {/* Archive */}
      <section className="certificate-archive">
        <div className="certificate-archive-inner">
          <h2>Issued certificates</h2>
          {archiveControls}
        </div>
        {gallery}
      </section>

      {/* Create / Edit Template Modal — portalled to document.body so position:fixed always hits the viewport */}
      {showForm && createPortal(
        <div className="cert-modal-backdrop" onClick={() => { setShowForm(false); setError('') }}>
          <form onSubmit={save} ref={modalRef} className="cert-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="cert-modal-header">
              <div>
                <h2>{editingTemplate ? 'Edit certificate template' : 'Create certificate template'}</h2>
                <p>Customize the final printed certificate.</p>
              </div>
              <button type="button" className="cert-modal-close-btn" onClick={() => { setShowForm(false); setError('') }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="cert-modal-body">
              <div className="template-form">
                {[['name','Template name'],['certificateTitle','Certificate title'],['subtitle','Subtitle'],['organizationName','Organization name'],['signatoryName','Authorized signatory'],['signatoryPosition','Signatory position'],['validityDays','Validity in days (optional)']].map(([field, label]) => (
                  <label key={field}>{label}
                    <input type={field === 'validityDays' ? 'number' : 'text'} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}/>
                  </label>
                ))}
                <label className="full">Certificate body text
                  <textarea value={form.bodyText} onChange={e => setForm({ ...form, bodyText: e.target.value })}/>
                </label>
                <label className="full">Organization logo
                  <input type="file" accept="image/*" onChange={e => upload('logoUrl', e.target.files?.[0])}/>
                  <small>{form.logoUrlName || 'PNG, JPG, SVG, or WEBP · max 8 MB'}</small>
                </label>
                <div className="full">
                  <label style={{ marginBottom: 6, display: 'block', fontSize: 11, fontWeight: 700, color: 'inherit' }}>
                    Authorized signatory signature
                  </label>
                  <ESignaturePad
                    value={form.signatureUrl}
                    onChange={val => setForm(current => ({ ...current, signatureUrl: val }))}
                    onFileNameChange={name => setForm(current => ({ ...current, signatureUrlName: name }))}
                    fileName={form.signatureUrlName}
                  />
                </div>
              </div>
            </div>
            <div className="cert-modal-footer">
              <button type="button" className="cert-cancel-btn" onClick={() => { setShowForm(false); setError('') }}>Cancel</button>
              <button type="submit" className="certificate-primary" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </Container>
  )
}
