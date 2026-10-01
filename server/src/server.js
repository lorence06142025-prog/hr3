import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import workflowRoutes from './routes/workflows.js'
import analyticsRoutes from './routes/analytics.js'
import certificateRoutes from './routes/certificates.js'
import notificationRoutes from './routes/notifications.js'
import employeeRoutes from './routes/employees.js'
import auditRoutes from './routes/audit.js'
import learningResourceRoutes from './routes/learningResources.js'
import chatRoutes from './routes/chat.js'
import trainingRoutes from './routes/training.js'
import recognitionRoutes from './routes/recognition.js'
import successionRoutes from './routes/succession.js'
import attendanceRoutes from './routes/attendance.js'
import { errorHandler, notFound, requestLogger } from './middleware.js'
import { pool } from './db.js'
import { logger } from './services/logger.js'
import { sendEmail } from './services/email.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (
      origin.includes('hostforge') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin === config.clientOrigin
    ) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json({ limit: '12mb' }))
app.use(requestLogger)
app.get('/', (_req, res) => res.json({ status: 'ok', name: 'pds-api' }))
app.get('/health', async (_req, res, next) => { try { await pool.query('SELECT 1'); res.json({ status: 'ok' }) } catch (error) { next(error) } })

// Public SMTP diagnostic — shows whether env vars reached the server (no auth required)
app.get('/smtp-check', (_req, res) => {
  res.json({
    BREVO_API_KEY: process.env.BREVO_API_KEY ? `✅ set (${process.env.BREVO_API_KEY.slice(0, 8)}...)` : '❌ NOT SET',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `✅ set (${process.env.RESEND_API_KEY.slice(0, 8)}...)` : '❌ NOT SET',
    SMTP_HOST: process.env.SMTP_HOST || '❌ NOT SET',
    SMTP_PORT: process.env.SMTP_PORT || '❌ NOT SET',
    SMTP_USER: process.env.SMTP_USER ? `✅ ${process.env.SMTP_USER}` : '❌ NOT SET',
    SMTP_PASS: process.env.SMTP_PASS ? `✅ set (${process.env.SMTP_PASS.length} chars)` : '❌ NOT SET',
    SMTP_FROM: process.env.SMTP_FROM || '❌ NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use('/api/learning', learningResourceRoutes)
app.use('/api/training', trainingRoutes)
app.use('/api/recognition', recognitionRoutes)
app.use('/api/succession', successionRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/chat', chatRoutes)
app.use(notFound)


app.use(errorHandler)
app.listen(config.port, '0.0.0.0', async () => {
  logger.info(`PDS API listening on 0.0.0.0:${config.port}`)
  // Eagerly warm up SMTP transporter and send startup ping if configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const result = await sendEmail({
        to: process.env.SMTP_USER,
        subject: '✅ Horeca Server Started Successfully',
        text: 'Your Horeca Hospitality HR backend has started and the email system is operational.',
      })
      logger.info(`[HORECA EMAIL] Startup ping: ${result.sent ? 'SENT ✅' : 'FAILED ❌'} — ${result.messageId || result.error || ''}`)
    } catch (err) {
      logger.warn(`[HORECA EMAIL] Startup ping failed: ${err.message}`)
    }
  }
})
