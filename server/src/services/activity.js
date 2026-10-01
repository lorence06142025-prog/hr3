import { query } from '../db.js'

/**
 * logActivity — best-effort, non-blocking audit helper.
 *
 * Inserts a row into activity_logs. It NEVER throws: if the table doesn't
 * exist yet (migration not run) or any DB error occurs, it logs a warning and
 * quietly continues so the primary request is never disrupted by auditing.
 *
 * @param {Object}  input
 * @param {Object}  [input.req]     Express request (for ip/user-agent context)
 * @param {Object}  [input.user]    decoded JWT user (req.user) — sub, role, name
 * @param {string}  input.action    machine-readable action key
 * @param {string}  input.category  broad grouping: auth|employee|certificate|learning|workflow|notification|system
 * @param {string}  [input.targetId] affected entity id (workflow/employee/etc)
 * @param {string}  [input.description] human-readable summary
 * @param {Object}  [input.details] structured JSONB payload
 */
export async function logActivity({ req, user, action, category, targetId, description, details = {} }) {
  try {
    await query(
      `INSERT INTO activity_logs
        (actor_id, actor_role, actor_name, action, category, target_id, description, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        user?.sub || null,
        user?.role || null,
        user?.name || null,
        action,
        category,
        targetId || null,
        description || null,
        JSON.stringify(details || {}),
        req?.ip || null,
        (req?.headers?.['user-agent'] || '').slice(0, 500) || null,
      ],
    )
  } catch (error) {
    // Non-blocking: audit must never break the primary request.
    if (error?.code === '42P01' || error?.message?.includes('relation "activity_logs" does not exist')) {
      console.warn('[activity] activity_logs table missing — run `npm run migrate` (021_activity_logs.sql) to enable audit logging.')
    } else {
      console.warn('[activity] Could not record activity:', error.message)
    }
  }
}
