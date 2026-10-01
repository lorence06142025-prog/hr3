import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const migrations = await fs.readdir(path.join(root, '../db/migrations'))
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
for (const name of migrations.filter((file) => file.endsWith('.sql')).sort()) {
  const seen = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])
  if (seen.rowCount) continue
  const rawSql = await fs.readFile(path.join(root, '../db/migrations', name), 'utf8')
  const sql = rawSql.replace(/^\uFEFF/, '')
  await pool.query('BEGIN')
  try { await pool.query(sql); await pool.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]); await pool.query('COMMIT'); console.log(`Applied ${name}`) }
  catch (error) { await pool.query('ROLLBACK'); throw error }
}
await pool.end()
