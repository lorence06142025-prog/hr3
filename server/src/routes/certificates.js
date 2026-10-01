import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import QRCode from 'qrcode'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { getScopeFilter } from '../services/departmentScope.js'
import { sendEmail } from '../services/email.js'

const router = Router()

// Public certificate verification endpoint — must be registered BEFORE the auth
// middleware so third parties can validate certificate authenticity without a token.
router.get('/verify/:code', async (req, res, next) => {
  try {
    let rawCode = String(req.params.code || '').trim()
    if (!rawCode) {
      return res.status(404).json({ valid: false, message: 'Certificate not found.' })
    }
    if (rawCode.includes('/verify/certificate/')) {
      rawCode = rawCode.split('/verify/certificate/').pop()
    } else if (rawCode.includes('/')) {
      rawCode = rawCode.split('/').pop()
    }
    rawCode = rawCode.split('?')[0].split('#')[0].trim()

    if (rawCode.toUpperCase().includes('SAMPLE')) {
      const sampleCert = {
        certificateNumber: 'PHS-2026-SAMPLE01',
        certificateType: 'Certificate of Excellence',
        title: 'Certificate of Excellence',
        subtitle: 'Sample Verification Preview',
        recipientName: 'Jane Doe',
        issuedDate: new Date().toISOString().slice(0, 10),
        expiryDate: null,
        status: 'valid',
        issuer: 'Priority Handling Services, Inc.',
        achievement: 'This is an authentic sample certificate verification preview demonstrating Priority Handling Services, Inc. online QR validation.',
        signatory: 'Ava Reyes',
        signatoryPosition: 'HR Business Partner',
        logoUrl: null,
        signatureUrl: null,
        verificationCode: 'SAMPLE-VERIFICATION-CODE',
        revokedAt: null,
        revokedReason: null
      }
      return res.json({
        valid: true,
        status: 'valid',
        verified: true,
        certificate: sampleCert
      })
    }

    const { rows } = await query(`SELECT c.id, c.certificate_number, c.verification_code, c.achievement_text, c.awarded_at, c.expires_at, c.status, c.revoked_at, c.revoked_reason,
      e.full_name AS employee_name, t.name AS template_name, t.certificate_title, t.subtitle, t.organization_name, t.signatory_name, t.signatory_position, t.logo_url, t.signature_url
      FROM certificates c JOIN employees e ON e.id=c.employee_id JOIN certificate_templates t ON t.id=c.template_id
      WHERE LOWER(coalesce(c.verification_code::text, ''))=$1 OR LOWER(c.id::text)=$1 OR LOWER(c.certificate_number)=$1`, [rawCode.toLowerCase()])
    if (!rows[0]) {
      return res.status(404).json({
        valid: false,
        message: 'Certificate not found.'
      })
    }
    let cert = rows[0]
    if (cert.status === 'issued' && cert.expires_at && new Date(cert.expires_at) < new Date(new Date().setHours(0,0,0,0))) {
      await query("UPDATE certificates SET status='expired', metadata=metadata || jsonb_build_object('expiredAt', NOW()::text) WHERE id=$1", [cert.id])
      cert.status = 'expired'
    }
    const publicCert = {
      certificateNumber: cert.certificate_number,
      certificateType: cert.template_name || cert.certificate_title || 'Excellence Certificate',
      title: cert.certificate_title,
      subtitle: cert.subtitle,
      recipientName: cert.employee_name,
      issuedDate: cert.awarded_at,
      expiryDate: cert.expires_at,
      status: cert.status === 'issued' ? 'valid' : cert.status,
      issuer: cert.organization_name,
      achievement: cert.achievement_text,
      signatory: cert.signatory_name,
      signatoryPosition: cert.signatory_position,
      logoUrl: cert.logo_url,
      signatureUrl: cert.signature_url,
      verificationCode: cert.verification_code,
      revokedAt: cert.revoked_at,
      revokedReason: cert.revoked_reason
    }

    if (cert.status === 'revoked') {
      return res.json({
        valid: false,
        status: 'revoked',
        message: 'This certificate has been revoked.',
        certificate: publicCert
      })
    }
    if (cert.status === 'expired') {
      return res.json({
        valid: false,
        status: 'expired',
        message: 'This certificate has expired.',
        certificate: publicCert
      })
    }
    return res.json({
      valid: true,
      status: 'valid',
      verified: true,
      certificate: publicCert
    })
  } catch (error) { next(error) }
})

router.get('/verify/:code/pdf', async (req, res, next) => {
  try {
    const rawCode = String(req.params.code || '').trim()
    let cert = null

    if (rawCode.toUpperCase().includes('SAMPLE')) {
      cert = {
        id: 'sample-id',
        certificate_number: 'PHS-2026-SAMPLE01',
        verification_code: 'SAMPLE-VERIFICATION-CODE',
        achievement_text: 'This is an authentic sample certificate verification preview demonstrating Priority Handling Services, Inc. online QR validation.',
        awarded_at: new Date().toISOString().slice(0, 10),
        expires_at: null,
        status: 'issued',
        employee_name: 'Jane Doe',
        template_name: 'Certificate of Excellence',
        certificate_title: 'Certificate of Excellence',
        subtitle: 'Sample Verification Preview',
        organization_name: 'Priority Handling Services, Inc.',
        signatory_name: 'Ava Reyes',
        signatory_position: 'HR Business Partner',
        logo_url: null,
        signature_url: null
      }
    } else {
      const { rows } = await query(`SELECT c.id, c.certificate_number, c.verification_code, c.achievement_text, c.awarded_at, c.expires_at, c.status,
        e.full_name AS employee_name, t.name AS template_name, t.certificate_title, t.subtitle, t.organization_name, t.signatory_name, t.signatory_position, t.logo_url, t.signature_url
        FROM certificates c JOIN employees e ON e.id=c.employee_id JOIN certificate_templates t ON t.id=c.template_id
        WHERE LOWER(c.verification_code::text)=$1 OR LOWER(c.id::text)=$1 OR LOWER(c.certificate_number)=$1`, [rawCode.toLowerCase()])
      if (!rows[0]) return res.status(404).json({ valid: false, message: 'Certificate not found.' })
      cert = rows[0]
    }

    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
    const verifyUrl = `${baseUrl}/verify/certificate/${cert.verification_code}`
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 260 })

    const title = `${cert.certificate_title} - ${cert.employee_name}`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="${cert.certificate_number}.html"`)
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; background: #f4f0ff; }
  .cert { width: 850px; background: linear-gradient(135deg, #fcfbff 0%, #f4f0ff 100%); border: 3px solid #654bd2; border-radius: 16px; padding: 48px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); position: relative; }
  .org { font-size: 12px; color: #7c778a; letter-spacing: 2px; text-transform: uppercase; }
  h1 { font-size: 32px; color: #282631; margin: 10px 0 4px; }
  .sub { font-size: 14px; color: #654bd2; font-weight: 600; }
  .recipient { font-size: 36px; color: #654bd2; font-weight: 800; margin: 20px 0 10px; }
  .rule { width: 100px; height: 3px; background: #654bd2; margin: 0 auto 16px; }
  .body { font-size: 14px; color: #4a4656; max-width: 600px; margin: 0 auto; line-height: 1.6; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; font-size: 12px; color: #7c778a; }
  .foot b { display: block; color: #282631; font-size: 14px; margin-top: 4px; }
  .qr { text-align: center; display: flex; flex-direction: column; align-items: center; }
  .qr img { width: 110px; height: 110px; border-radius: 4px; border: 1px solid #e4e1f7; }
  .qr small { display: block; font-size: 9px; color: #654bd2; font-weight: 600; margin-top: 3px; }
  .number { margin-top: 30px; font-size: 11px; color: #9b97a6; }
  @media print { body { background: none; } .cert { border: none; box-shadow: none; width: 100%; } }
</style>
</head>
<body onload="if (window.location.search.includes('print=true')) window.print()">
<div class="cert">
  <div class="org">${cert.organization_name}</div>
  <h1>${cert.certificate_title}</h1>
  <div class="sub">${cert.subtitle || 'Certificate of Recognition'}</div>
  <p style="color:#7c778a; margin-top: 24px;">This certificate is proudly presented to</p>
  <div class="recipient">${cert.employee_name}</div>
  <div class="rule"></div>
  <div class="body">${cert.achievement_text}</div>
  <div class="foot">
    <div>Awarded Date<br><b>${new Date(cert.awarded_at).toLocaleDateString()}</b></div>
    <div class="qr">
      <img src="${qrDataUrl}" alt="QR Code">
      <small>VERIFY ONLINE</small>
    </div>
    <div>Authorized Signatory<br><b>${cert.signatory_name}</b><br><small>${cert.signatory_position || ''}</small></div>
  </div>
  <div class="number">Certificate No. ${cert.certificate_number} · Verification Code: ${cert.verification_code}</div>
</div>
</body>
</html>`)
  } catch (error) { next(error) }
})

router.use(authenticate)
const imageValue = z.string().max(11500000).optional().or(z.literal('')).default('')
const templateSchema = z.object({ name: z.string().min(3).max(120), certificateTitle: z.string().min(3).max(160), subtitle: z.string().max(180).optional().default(''), organizationName: z.string().min(2).max(160), bodyText: z.string().min(10).max(2000), logoUrl: imageValue, signatoryName: z.string().min(2).max(120), signatoryPosition: z.string().max(120).optional().default(''), signatureUrl: imageValue, backgroundUrl: imageValue, validityDays: z.coerce.number().int().positive().nullable().optional() })
const issueSchema = z.object({ templateId: z.string().uuid(), employeeIds: z.array(z.string().uuid()).min(1).max(100), achievementText: z.string().min(5).max(1000), awardedAt: z.string().date().optional() })
const revokeSchema = z.object({ reason: z.string().min(3).max(500) })

router.get('/templates', authorize('hr'), async (_req, res, next) => { try { const { rows } = await query('SELECT * FROM certificate_templates WHERE is_active=true ORDER BY created_at DESC'); res.json({ templates: rows }) } catch (error) { next(error) } })
router.post('/templates', authorize('hr'), async (req, res, next) => { try { const input = templateSchema.parse(req.body); const { rows } = await query('INSERT INTO certificate_templates(name,certificate_title,subtitle,organization_name,body_text,logo_url,signatory_name,signatory_position,signature_url,background_url,validity_days,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [input.name, input.certificateTitle, input.subtitle, input.organizationName, input.bodyText, input.logoUrl || null, input.signatoryName, input.signatoryPosition || null, input.signatureUrl || null, input.backgroundUrl || null, input.validityDays || null, req.user.sub]); await logActivity({ req, user: req.user, action: 'certificate.template_create', category: 'certificate', targetId: rows[0].id, description: `${req.user.name} created certificate template ${input.name}` }); res.status(201).json({ template: rows[0] }) } catch (error) { next(error) } })
router.patch('/templates/:id', authorize('hr'), async (req, res, next) => { try { const input = templateSchema.parse(req.body); const { rows } = await query('UPDATE certificate_templates SET name=$1,certificate_title=$2,subtitle=$3,organization_name=$4,body_text=$5,logo_url=$6,signatory_name=$7,signatory_position=$8,signature_url=$9,background_url=$10,validity_days=$11,updated_at=NOW() WHERE id=$12 RETURNING *', [input.name, input.certificateTitle, input.subtitle, input.organizationName, input.bodyText, input.logoUrl || null, input.signatoryName, input.signatoryPosition || null, input.signatureUrl || null, input.backgroundUrl || null, input.validityDays || null, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Certificate template not found.' }); await logActivity({ req, user: req.user, action: 'certificate.template_update', category: 'certificate', targetId: req.params.id, description: `${req.user.name} updated certificate template ${rows[0].name}` }); res.json({ template: rows[0] }) } catch (error) { next(error) } })
router.delete('/templates/:id', authorize('hr'), async (req, res, next) => { try { const { rows } = await query('UPDATE certificate_templates SET is_active=false,updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Certificate template not found.' }); await logActivity({ req, user: req.user, action: 'certificate.template_retire', category: 'certificate', targetId: req.params.id, description: `${req.user.name} retired certificate template ${rows[0].name}` }); res.json({ retired: true, id: req.params.id }) } catch (error) { next(error) } })
router.get('/', authorize('hr', 'supervisor', 'employee'), async (req, res, next) => { try {
    // Run auto-expire asynchronously in the background so it does not block the list fetch
    void query("UPDATE certificates SET status='expired', metadata=metadata || jsonb_build_object('expiredAt', NOW()::text) WHERE status='issued' AND expires_at IS NOT NULL AND expires_at < NOW()::date").catch(() => {})
    const scope = await getScopeFilter(req.user)
    const params = []; let where = 'WHERE 1=1'
    if (scope.isEmployee) { params.push(scope.employeeId); where += ` AND c.employee_id=$${params.length}` }
    else if (scope.isScoped && scope.department) { params.push(scope.department); where += ` AND e.department=$${params.length}` }
    const { page = '1', limit = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))
    const offset = (pageNum - 1) * limitNum
    params.push(limitNum, offset)
    // Single query: COUNT(*) OVER() avoids a separate count round-trip
    // Exclude repetitive base64 logo_url / signature_url from the list payload to ensure fast loading
    const { rows } = await query(
      `SELECT c.id, c.template_id, c.employee_id, c.certificate_number, c.verification_code,
              c.achievement_text, c.awarded_at, c.expires_at, c.status, c.revoked_at, c.revoked_reason,
              c.issued_by, c.issued_at, c.metadata,
              e.full_name AS employee_name, e.department,
              t.name AS template_name, t.certificate_title, t.subtitle, t.organization_name,
              t.body_text, t.signatory_name, t.signatory_position,
              COUNT(*) OVER() AS _total
       FROM certificates c
       JOIN employees e ON e.id=c.employee_id
       JOIN certificate_templates t ON t.id=c.template_id
       ${where}
       ORDER BY c.issued_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const total = rows[0]?._total ? parseInt(rows[0]._total, 10) : 0
    // Strip _total from each row before sending
    const certificates = rows.map(({ _total, ...r }) => r)
    res.json({ certificates, total, page: pageNum, limit: limitNum })
  } catch (error) { next(error) } })
router.post('/issue', authorize('hr'), async (req, res, next) => {
  try {
    const input = issueSchema.parse(req.body)
    const result = await transaction(async client => {
      const templateResult = await client.query('SELECT * FROM certificate_templates WHERE id=$1 AND is_active=true', [input.templateId])
      const template = templateResult.rows[0]
      if (!template) throw Object.assign(new Error('Certificate template is not available.'), { status: 404 })
      const people = await client.query('SELECT id, full_name, department, employee_number FROM employees WHERE id = ANY($1::uuid[]) AND is_active=true', [input.employeeIds])
      if (people.rowCount !== input.employeeIds.length) throw Object.assign(new Error('One or more selected employees are unavailable.'), { status: 400 })
      const created = []
      for (const employee of people.rows) {
        const certificateNumber = `PHS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
        const verificationCode = `V-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
        const expiresAt = template.validity_days ? new Date(Date.parse(input.awardedAt || new Date().toISOString().slice(0, 10)) + template.validity_days * 86400000).toISOString().slice(0, 10) : null
        const inserted = await client.query(
          'INSERT INTO certificates(template_id,employee_id,certificate_number,verification_code,achievement_text,awarded_at,expires_at,issued_by,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
          [template.id, employee.id, certificateNumber, verificationCode, input.achievementText, input.awardedAt || new Date().toISOString().slice(0, 10), expiresAt, req.user.sub, { employeeName: employee.full_name, employeeNumber: employee.employee_number, department: employee.department }]
        )
        const certRecord = inserted.rows[0]
        created.push(certRecord)

        // Find user email and dispatch certificate award email
        const u = await client.query('SELECT id, email, full_name FROM users WHERE employee_id=$1 AND is_active=true', [employee.id])
        if (u.rows[0]?.email) {
          const userRec = u.rows[0]
          const verifyUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/verify/certificate/${certRecord.verification_code}`
          sendEmail({
            to: userRec.email,
            subject: `🏆 Certificate Awarded: ${template.certificate_title}`,
            text: `Congratulations ${employee.full_name}! You have been awarded the "${template.certificate_title}" certificate (Certificate No: ${certificateNumber}).`,
            details: [
              ['Certificate Title', template.certificate_title],
              ['Recipient', employee.full_name],
              ['Certificate No.', certificateNumber],
              ['Award Date', input.awardedAt || new Date().toISOString().slice(0, 10)],
              ['Organization', template.organization_name],
              ['Signatory', template.signatory_name],
            ],
            actionUrl: verifyUrl,
            actionText: 'View & Verify Online Certificate',
          }).catch(err => console.warn('[PHS EMAIL] Certificate email dispatch error:', err.message))
        }
      }
      return created
    })
    await logActivity({ req, user: req.user, action: 'certificate.issue', category: 'certificate', description: `${req.user.name} issued ${result.length} certificate(s) using template ${input.templateId}`, details: { count: result.length, employeeIds: input.employeeIds } })
    res.status(201).json({ certificates: result })
  } catch (error) { next(error) }
})
router.post('/:id/revoke', authorize('hr'), async (req, res, next) => { try { const input = revokeSchema.parse(req.body); const { rows } = await query("UPDATE certificates SET status='revoked', revoked_at=NOW(), revoked_reason=$1 WHERE id=$2 AND status='issued' RETURNING *", [input.reason, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Issued certificate not found.' }); await logActivity({ req, user: req.user, action: 'certificate.revoke', category: 'certificate', targetId: req.params.id, description: `${req.user.name} revoked certificate ${rows[0].certificate_number}`, details: { reason: input.reason } }); res.json({ certificate: rows[0] }) } catch (error) { next(error) } })
router.post('/:id/regenerate', authorize('hr'), async (req, res, next) => { try { const { rows } = await query("UPDATE certificates SET metadata=metadata || jsonb_build_object('regeneratedAt', NOW()::text) WHERE id=$1 AND status='issued' RETURNING *", [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Issued certificate not found.' }); await logActivity({ req, user: req.user, action: 'certificate.regenerate', category: 'certificate', targetId: req.params.id, description: `${req.user.name} regenerated certificate ${rows[0].certificate_number}` }); res.json({ certificate: rows[0] }) } catch (error) { next(error) } })
// Expiry automation — HR can manually trigger the expiry check. The GET / route also auto-runs this.
router.post('/check-expiry', authorize('hr'), async (req, res, next) => {
  try {
const { rows } = await query("UPDATE certificates SET status='expired', metadata=metadata || jsonb_build_object('expiredAt', NOW()::text) WHERE status='issued' AND expires_at IS NOT NULL AND expires_at < NOW()::date RETURNING id")
    if (rows.length) await logActivity({ req, user: req.user, action: 'certificate.auto_expire', category: 'certificate', description: `${req.user.name} ran expiry check — ${rows.length} certificate(s) expired` })
    res.json({ expired: rows.length, certificates: rows })
  } catch (error) { next(error) }
})
export default router
