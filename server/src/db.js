import pg from 'pg'
import { config } from './config.js'

const isRemoteDb = Boolean(
  config.databaseUrl && (
    config.databaseUrl.includes('supabase.com') ||
    config.databaseUrl.includes('neon.tech') ||
    config.databaseUrl.includes('railway') ||
    config.databaseUrl.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production'
  )
)

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
})

export const query = (text, params) => pool.query(text, params)

pool.on('error', (err) => {
  console.error('[DATABASE] Unexpected error on idle client:', err.message)
})

export async function transaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
