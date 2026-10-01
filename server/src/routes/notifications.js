import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware.js'
import { getOutboxQueue, sendEmail } from '../services/email.js'
import { query } from '../db.js'

const router = Router()
router.use(authenticate)

const testEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).default('Horeca Live Test Email'),
  message: z.string().min(1).default('This is a test notification email dispatched from Horeca Hospitality HR System.'),
})

// GET /api/notifications — user's workflow notifications
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '30' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30))
    const offset = (pageNum - 1) * limitNum
    const countResult = await query('SELECT count(*)::int AS total FROM notifications WHERE user_id=$1', [req.user.sub])
    const total = countResult.rows[0]?.total || 0
    const { rows } = await query(
      'SELECT id, workflow_id, title, message, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.sub, limitNum, offset]
    )
    res.json({ notifications: rows, unread: rows.filter(item => !item.is_read).length, total, page: pageNum, limit: limitNum })
  } catch (error) { next(error) }
})

router.post('/read', async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read=true, read_at=NOW() WHERE user_id=$1 AND is_read=false', [req.user.sub])
    res.json({ saved: true })
  } catch (error) { next(error) }
})

// GET /api/notifications/outbox — Live email outbox inspector (HR & management only)
router.get('/outbox', authorize('hr', 'management'), (req, res) => {
  const queue = getOutboxQueue()
  res.json({ emails: queue, total: queue.length })
})

// GET /api/notifications/smtp-status — Diagnostic: confirm which env vars are present on the server
router.get('/smtp-status', authorize('hr', 'management'), (req, res) => {
  res.json({
    SMTP_HOST: process.env.SMTP_HOST || '❌ NOT SET',
    SMTP_PORT: process.env.SMTP_PORT || '❌ NOT SET',
    SMTP_USER: process.env.SMTP_USER ? `✅ ${process.env.SMTP_USER}` : '❌ NOT SET',
    SMTP_PASS: process.env.SMTP_PASS ? `✅ set (${process.env.SMTP_PASS.length} chars)` : '❌ NOT SET',
    SMTP_FROM: process.env.SMTP_FROM || '❌ NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  })
})

// POST /api/notifications/test-email — Send a test email to verify live delivery
router.post('/test-email', authorize('hr', 'management'), async (req, res, next) => {
  try {
    const input = testEmailSchema.parse(req.body)
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.message,
      details: [
        ['Sender', req.user.name || 'HR Administrator'],
        ['Timestamp', new Date().toLocaleString()],
        ['Delivery Mode', process.env.SMTP_HOST ? 'Live Production SMTP' : 'Ethereal Test Sandbox'],
      ],
      actionUrl: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      actionText: 'Open Horeca Portal',
    })
    res.json({
      success: result.sent !== false,
      message: result.sent ? 'Email delivered successfully' : 'Email dispatched in demo mode',
      previewUrl: result.previewUrl || null,
      emailRecord: result.emailRecord,
    })
  } catch (error) { next(error) }
})

export default router
