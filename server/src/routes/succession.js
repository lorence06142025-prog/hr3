import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { getScopeFilter, getUserDepartment, verifyEmployeeAccess } from '../services/departmentScope.js'
import {
  getAuthorizedEmployeeData,
  generateSuccessionAssessment,
  approveSuccessionTransaction,
  returnSuccessionTransaction,
  rejectSuccessionTransaction,
} from '../services/successionService.js'

const router = Router()
router.use(authenticate)

const assessSchema = z.object({
  employeeId: z.string().uuid(),
})

const reviewSchema = z.object({
  decision: z.enum(['approve', 'return', 'reject']),
  targetPosition: z.string().min(2).max(120).optional(),
  note: z.string().max(2000).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const directApproveSchema = z.object({
  employeeId: z.string().uuid(),
  targetPosition: z.string().min(2).max(120),
  note: z.string().max(2000).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// GET /api/succession/positions - List available target positions
router.get('/positions', authorize('hr', 'supervisor', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    let sql = 'SELECT id, title, department, is_critical, description, required_competencies, required_learning, min_performance_score, min_competency_score, min_learning_progress FROM positions'
    const params = []

    if (scope.isScoped && scope.department) {
      params.push(scope.department)
      sql += ' WHERE department = $1'
    }
    sql += ' ORDER BY is_critical DESC, title ASC'

    const { rows } = await query(sql, params)
    res.json({ positions: rows })
  } catch (error) {
    next(error)
  }
})

// GET /api/succession/candidates - List eligible succession candidates
router.get('/candidates', authorize('hr', 'supervisor', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    let where = 'WHERE e.is_active = true'
    const params = []

    if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }

    const { rows } = await query(
      `SELECT e.id, e.employee_number, e.full_name, e.department, e.job_title,
              e.performance_score, e.competency_score, e.learning_progress,
              coalesce(sp.readiness_score, round(e.performance_score * 0.5 + e.competency_score * 0.3 + e.learning_progress * 0.2))::int AS readiness_score,
              coalesce(sp.readiness_band,
                CASE
                  WHEN round(e.performance_score * 0.5 + e.competency_score * 0.3 + e.learning_progress * 0.2) >= 85 THEN 'ready_now'
                  WHEN round(e.performance_score * 0.5 + e.competency_score * 0.3 + e.learning_progress * 0.2) >= 70 THEN 'ready_in_1_2_years'
                  ELSE 'development_needed'
                END
              ) AS readiness_band,
              sp.target_role,
              (SELECT count(*)::int FROM workflows w WHERE w.module = 'succession' AND w.subject_employee_id = e.id AND w.status = 'active') AS active_workflow_count
       FROM employees e
       LEFT JOIN succession_profiles sp ON sp.employee_id = e.id
       ${where}
       ORDER BY readiness_score DESC, e.full_name ASC`,
      params
    )

    res.json({ candidates: rows })
  } catch (error) {
    next(error)
  }
})

// POST /api/succession/assess - AI Succession Assessment & Critical Role Recommendation
router.post('/assess', authorize('hr', 'supervisor', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const { employeeId } = assessSchema.parse(req.body)

    // Employees cannot run succession assessments on other employees
    if (req.user.role === 'employee' && req.user.employeeId !== employeeId) {
      return res.status(403).json({ error: 'Access denied: You can only access your own records.' })
    }

    const assessment = await generateSuccessionAssessment(req.user, employeeId)
    res.json({ assessment })
  } catch (error) {
    next(error)
  }
})

// POST /api/succession/workflows/:id/review - Human Review (Approve / Return / Reject)
router.post('/workflows/:id/review', authorize('hr', 'supervisor', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const input = reviewSchema.parse(req.body)

    const result = await transaction(async (client) => {
      const wfRes = await client.query('SELECT * FROM workflows WHERE id = $1 FOR UPDATE', [req.params.id])
      const workflow = wfRes.rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already completed or cancelled.'), { status: 409 })

      // Verify scope on subject employee
      await verifyEmployeeAccess(req.user, workflow.subject_employee_id)

      // Employee CANNOT approve own succession
      if (req.user.employeeId && req.user.employeeId === workflow.subject_employee_id) {
        throw Object.assign(new Error('Access denied: Employees cannot review or approve their own succession.'), { status: 403 })
      }

      if (input.decision === 'approve') {
        const targetPos = input.targetPosition || workflow.metadata?.recommendedPosition || workflow.metadata?.targetRole
        if (!targetPos) {
          throw Object.assign(new Error('A target position must be specified to approve succession.'), { status: 400 })
        }

        return await approveSuccessionTransaction(client, {
          workflowId: workflow.id,
          employeeId: workflow.subject_employee_id,
          targetPosition: targetPos,
          actorUser: req.user,
          note: input.note,
          effectiveDate: input.effectiveDate,
        })
      }

      if (input.decision === 'return') {
        return await returnSuccessionTransaction(client, {
          workflowId: workflow.id,
          actorUser: req.user,
          note: input.note,
        })
      }

      if (input.decision === 'reject') {
        return await rejectSuccessionTransaction(client, {
          workflowId: workflow.id,
          actorUser: req.user,
          reason: input.note,
        })
      }

      throw Object.assign(new Error('Invalid review decision.'), { status: 400 })
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/succession/direct-approve - Direct approval (atomic transaction without workflow id)
router.post('/direct-approve', authorize('hr', 'supervisor', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const input = directApproveSchema.parse(req.body)

    // Employees cannot approve own succession
    if (req.user.employeeId && req.user.employeeId === input.employeeId) {
      return res.status(403).json({ error: 'Access denied: Employees cannot approve their own succession.' })
    }

    await verifyEmployeeAccess(req.user, input.employeeId)

    const result = await transaction(async (client) => {
      return await approveSuccessionTransaction(client, {
        employeeId: input.employeeId,
        targetPosition: input.targetPosition,
        actorUser: req.user,
        note: input.note,
        effectiveDate: input.effectiveDate,
      })
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// GET /api/succession/records - Historical succession records
router.get('/records', authorize('hr', 'supervisor', 'management', 'operations_manager', 'employee'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    let where = ''
    const params = []

    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where = 'WHERE sr.employee_id = $1'
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where = 'WHERE e.department = $1'
    }

    const { rows } = await query(
      `SELECT sr.*, e.full_name AS employee_name, e.employee_number, e.department,
              u.full_name AS reviewer_name
       FROM succession_records sr
       JOIN employees e ON e.id = sr.employee_id
       LEFT JOIN users u ON u.id = sr.reviewer_id
       ${where}
       ORDER BY sr.created_at DESC
       LIMIT 100`,
      params
    )

    res.json({ records: rows })
  } catch (error) {
    next(error)
  }
})

// GET /api/succession/employee/:id/history - Position history and past succession records
router.get('/employee/:id/history', authorize('hr', 'supervisor', 'management', 'operations_manager', 'employee'), async (req, res, next) => {
  try {
    await verifyEmployeeAccess(req.user, req.params.id)

    const [posRes, succRes] = await Promise.all([
      query(
        `SELECT ph.*, u.full_name AS approved_by_name
         FROM position_history ph
         LEFT JOIN users u ON u.id = ph.approved_by
         WHERE ph.employee_id = $1
         ORDER BY ph.effective_date DESC, ph.created_at DESC`,
        [req.params.id]
      ),
      query(
        `SELECT sr.*, u.full_name AS reviewer_name
         FROM succession_records sr
         LEFT JOIN users u ON u.id = sr.reviewer_id
         WHERE sr.employee_id = $1
         ORDER BY sr.created_at DESC`,
        [req.params.id]
      ),
    ])

    res.json({
      positionHistory: posRes.rows,
      successionRecords: succRes.rows,
    })
  } catch (error) {
    next(error)
  }
})

export default router
