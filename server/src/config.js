import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true })
dotenv.config({ override: true })

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL must be set in production')
}
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY WARNING] JWT_SECRET not set in environment. Using fallback secret.')
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/perdevsys',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
}
