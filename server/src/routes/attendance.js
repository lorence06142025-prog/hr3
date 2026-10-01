import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware.js'
import {
  fetchAndSyncAttendanceFromHR2,
  getEmployeeAttendance,
  getAttendanceSummary,
  listAttendanceRecords,
} from '../services/hr2Service.js'
import { logActivity } from '../services/activity.js'

const router = Router()
router.use(authenticate)

const listQuerySchema = z.object({
  department: z.string().optional(),
  search: z.string().optional(),
  period: z.string().default('Q1 2026'),
  limit: z.coerce.number().min(1).max(200).default(100),
})

const syncSchema = z.object({
  period: z.string().default('Q1 2026'),
})

// GET /api/attendance — list records with optional filters
router.get('/', async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query)
    
    // Department head scoping: if supervisor, default to their department if not set
    let deptFilter = filters.department
    if (req.user.role === 'supervisor' && !deptFilter && req.user.department) {
      deptFilter = req.user.department
    }

    const records = await listAttendanceRecords({
      department: deptFilter,
      search: filters.search,
      period: filters.period,
      limit: filters.limit,
    })

    res.json({ records })
  } catch (error) {
    next(error)
  }
})

// GET /api/attendance/summary — aggregate attendance metrics for dashboard
router.get('/summary', async (req, res, next) => {
  try {
    let deptFilter = req.query.department || null
    if (req.user.role === 'supervisor' && !deptFilter && req.user.department) {
      deptFilter = req.user.department
    }
    const period = req.query.period || 'Q1 2026'

    const summary = await getAttendanceSummary({
      department: deptFilter,
      period,
    })

    res.json({ summary })
  } catch (error) {
    next(error)
  }
})

// GET /api/attendance/employee/:employeeId — get attendance record for an employee
router.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params
    const period = req.query.period || 'Q1 2026'

    const record = await getEmployeeAttendance(employeeId, period)
    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found for this employee.' })
    }

    res.json({ record })
  } catch (error) {
    next(error)
  }
})

// POST /api/attendance/sync — trigger DTR sync from HR2
router.post('/sync', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const { period } = syncSchema.parse(req.body || {})
    
    const result = await fetchAndSyncAttendanceFromHR2({
      period,
      actorId: req.user.sub,
    })

    await logActivity({
      req,
      user: req.user,
      action: 'attendance.sync',
      category: 'system',
      description: `${req.user.name || 'User'} synchronized ${result.syncedCount} attendance records from HR2 (${result.syncSource}) for period ${period}`,
      details: result,
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router
