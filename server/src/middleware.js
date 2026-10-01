import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import { config } from './config.js'
import { query } from './db.js'
import { logger } from './services/logger.js'

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication is required.' })
  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    // Check if token is an access token (15min expiry) — not a long-lived one
    if (decoded.exp && decoded.exp - decoded.iat > 3600) {
      return res.status(401).json({ error: 'Invalid token type.' })
    }
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired.' })
  }
}

export function authorize(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have access to this action.' })
}

export function notFound(req, res) {
  logger.warn('Resource not found', { method: req.method, path: req.originalUrl })
  res.status(404).json({ error: 'Resource not found.' })
}
export function errorHandler(error, req, res, _next) {
  // Log full details server-side; never leak stack to the client.
  logger.error('Request failed', {
    message: error.message,
    status: error.status || 500,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.sub || null,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
  })
  if (error instanceof ZodError) return res.status(400).json({ error: 'Please check the submitted information.', fields: error.flatten().fieldErrors })
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' })
}

// Request logging middleware — logs method, path, status, duration, and actor.
export function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.sub || null,
      ip: req.ip,
    })
  })
  next()
}
