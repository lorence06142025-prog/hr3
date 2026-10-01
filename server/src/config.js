import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const productionSetByHost = process.env.NODE_ENV === 'production'

if (!productionSetByHost) {
  dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false })
  dotenv.config({ override: false })
}

const isProduction = process.env.NODE_ENV === 'production'

const requiredProductionValue = (name) => {
  const value = process.env[name]?.trim()
  if (isProduction && !value) throw new Error(`${name} must be set in production`)
  return value || ''
}

const validateDatabaseUrl = (value) => {
  if (!value) return 'postgresql://postgres:postgres@localhost:5432/perdevsys'
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol')
  }
  return value
}

const validateClientOrigin = (value) => {
  const candidate = value || 'http://localhost:5173'
  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('CLIENT_ORIGIN must be a valid absolute URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('CLIENT_ORIGIN must be an HTTP(S) origin without credentials')
  }
  if (isProduction && url.protocol !== 'https:') {
    throw new Error('CLIENT_ORIGIN must use HTTPS in production')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CLIENT_ORIGIN must contain only the application origin, without a path')
  }
  return url.origin
}

const databaseUrl = validateDatabaseUrl(requiredProductionValue('DATABASE_URL'))
const jwtSecret = requiredProductionValue('JWT_SECRET') || 'development-only-change-me'
if (isProduction && (jwtSecret.length < 32 || /replace|placeholder|example|change-me/i.test(jwtSecret))) {
  throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production')
}
if (isProduction && /[<>]|example\.com|db-host/i.test(databaseUrl)) {
  throw new Error('Replace the DATABASE_URL template placeholders with production database credentials')
}

const clientOrigin = validateClientOrigin(requiredProductionValue('CLIENT_ORIGIN'))
if (process.env.CLIENT_ORIGIN) process.env.CLIENT_ORIGIN = clientOrigin
const publicAppUrl = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || ''
if (isProduction) {
  if (!publicAppUrl) throw new Error('PUBLIC_APP_URL or APP_URL must be set in production')
  let publicUrl
  try {
    publicUrl = new URL(publicAppUrl)
  } catch {
    throw new Error('PUBLIC_APP_URL or APP_URL must be a valid absolute URL')
  }
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password) {
    throw new Error('PUBLIC_APP_URL or APP_URL must be an HTTPS URL without credentials in production')
  }
  if (/example\.com|localhost|127\.0\.0\.1/i.test(publicUrl.hostname) || /example\.com|localhost|127\.0\.0\.1/i.test(new URL(clientOrigin).hostname)) {
    throw new Error('Replace example and localhost URLs with your deployed HTTPS domains')
  }
}

const brevoReady = Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim())
const resendReady = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim())
const smtpReady = Boolean(
  process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() &&
  process.env.SMTP_PASS?.trim() && process.env.SMTP_FROM?.trim()
)
if (isProduction && !brevoReady && !resendReady && !smtpReady) {
  throw new Error('Configure a production email provider: Brevo, Resend, or authenticated SMTP with a sender address')
}

const smtpPort = Number(process.env.SMTP_PORT || 587)
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error('SMTP_PORT must be an integer between 1 and 65535')
}
const port = Number(process.env.PORT || 4000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}
if (process.env.SMTP_SECURE && !['true', 'false'].includes(process.env.SMTP_SECURE.toLowerCase())) {
  throw new Error('SMTP_SECURE must be either true or false')
}
const smtpSecure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
if (isProduction && /example\.com/i.test(`${process.env.BREVO_SENDER_EMAIL || ''} ${process.env.RESEND_FROM || ''} ${process.env.SMTP_FROM || ''}`)) {
  throw new Error('Replace example sender addresses with an address verified by your production email provider')
}

export const config = {
  isProduction,
  port,
  databaseUrl,
  jwtSecret,
  clientOrigin,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  smtpHost: process.env.SMTP_HOST,
  smtpPort,
  smtpSecure,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
}
