// Lightweight structured logger
// Emits JSON lines to stdout for easy parsing by log aggregators (e.g. pino-format,
// CloudWatch, Datadog). No external dependencies.

import { config } from '../config.js'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 }

function shouldLog(level) {
  const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 20
  return LEVELS[level] >= threshold
}

function write(level, message, meta) {
  if (!shouldLog(level)) return
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  }
  if (meta && typeof meta === 'object') {
    // Avoid logging huge objects / circular refs
    try {
      entry.meta = JSON.stringify(meta)
    } catch {
      entry.meta = String(meta)
    }
  }
  // In dev, pretty-print for readability
  if (process.env.NODE_ENV !== 'production') {
    const metaStr = entry.meta ? ` ${entry.meta}` : ''
    const line = `[${level.toUpperCase()}] ${entry.time} ${message}${metaStr}`
    if (level === 'error' || level === 'fatal') console.error(line)
    else console.log(line)
    return
  }
  if (level === 'error' || level === 'fatal') console.error(JSON.stringify(entry))
  else console.log(JSON.stringify(entry))
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  fatal: (message, meta) => write('fatal', message, meta),
  child: (bindings) => ({
    debug: (m, meta) => write('debug', m, { ...bindings, ...meta }),
    info: (m, meta) => write('info', m, { ...bindings, ...meta }),
    warn: (m, meta) => write('warn', m, { ...bindings, ...meta }),
    error: (m, meta) => write('error', m, { ...bindings, ...meta }),
    fatal: (m, meta) => write('fatal', m, { ...bindings, ...meta }),
  }),
}

export default logger
