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
    const isDevelopmentOrigin = origin.includes('localhost') || origin.includes('127.0.0.1')
    const isKnownDevelopmentHost = origin.includes('hostforge') || origin.endsWith('.vercel.app')
    if (origin === config.clientOrigin || (!config.isProduction && (isDevelopmentOrigin || isKnownDevelopmentHost))) {
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

if (!config.isProduction) {
  app.get('/smtp-check', (_req, res) => {
    res.json({
      BREVO_API_KEY: process.env.BREVO_API_KEY ? 'set' : 'not set',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set' : 'not set',
      SMTP_HOST: process.env.SMTP_HOST || 'not set',
      SMTP_PORT: process.env.SMTP_PORT || 'not set',
      SMTP_USER: process.env.SMTP_USER ? 'set' : 'not set',
      SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'not set',
      SMTP_FROM: process.env.SMTP_FROM ? 'set' : 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    })
  })
}

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
  logger.info(`PHS API listening on 0.0.0.0:${config.port}`)
  // Eagerly warm up SMTP transporter and send startup ping if configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const result = await sendEmail({
        to: process.env.SMTP_USER,
        subject: 'Priority Handling Services, Inc. server started successfully',
        text: 'The Priority Handling Services, Inc. backend has started and the email system is operational.',
      })
      logger.info(`[PHS EMAIL] Startup ping: ${result.sent ? 'SENT ✅' : 'FAILED ❌'} — ${result.messageId || result.error || ''}`)
    } catch (err) {
      logger.warn(`[PHS EMAIL] Startup ping failed: ${err.message}`)
    }
  }
})
