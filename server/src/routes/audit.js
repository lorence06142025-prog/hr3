import { Router } from 'express'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()
router.use(authenticate)

// GET /api/audit-logs — paginated, filterable unified audit & trail log.
//
// Access control:
//   - hr, operations_manager, management : full visibility across all accounts/roles
//   - supervisor : sees only their own activity (their role's own trail)
//   - employee    : sees only their own activity
//
// The endpoint returns activity_logs — the general-purpose trail that records
// every module action (auth, employees, certificates, learning, workflows...).
// The dedicated workflow_events table remains the source of truth for workflow
// lifecycle specifically, but every workflow action is ALSO mirrored here.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit

    const params = []
    let where = 'WHERE 1=1'
    let idx = 1

    // Role scoping: non-management roles only see their own trail.
    const isFullAccess = ['hr', 'operations_manager', 'management'].includes(req.user.role)
    if (!isFullAccess) {
      params.push(req.user.sub)
      where += ` AND al.actor_id = $${idx++}`
    }

    if (req.query.category) {
      params.push(req.query.category)
      where += ` AND al.category = $${idx++}`
    }
    if (req.query.action) {
      params.push(req.query.action)
      where += ` AND al.action = $${idx++}`
    }
    if (req.query.actorId) {
      params.push(req.query.actorId)
      where += ` AND al.actor_id = $${idx++}`
    }
    if (req.query.targetId) {
      params.push(req.query.targetId)
      where += ` AND al.target_id = $${idx++}`
    }
    if (req.query.from) {
      params.push(req.query.from)
      where += ` AND al.created_at >= $${idx++}`
    }
    if (req.query.to) {
      params.push(req.query.to)
      where += ` AND al.created_at <= $${idx++}`
    }

    const [{ rows: countRows }, { rows }] = await Promise.all([
      query(`SELECT count(*)::int AS total FROM activity_logs al ${where}`, params),
      query(`
        SELECT al.id, al.actor_id, al.actor_role, al.actor_name, al.action,
               al.category, al.target_id, al.description, al.details,
               al.ip_address, al.user_agent, al.created_at
        FROM activity_logs al
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...params, limit, offset]),
    ])

    res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        pages: Math.ceil((countRows[0].total || 0) / limit),
      },
    })
  } catch (error) { next(error) }
})

export default router
