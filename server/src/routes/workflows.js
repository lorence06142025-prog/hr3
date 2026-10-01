import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { stagesFor, nextStage, returnToStage, canActOnStage } from '../workflow.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { saveMetricsForWorkflow, generateOnDemand, getReportsForWorkflow, calculateMetrics } from '../services/aiReports.js'
import { getScopeFilter, verifyEmployeeAccess, verifyWorkflowAccess } from '../services/departmentScope.js'
import { applyWorkflowScoreWriteBack, autoAssignGapLearning, getCompetencyComparison } from '../services/workflowCompletion.js'
import { approveSuccessionTransaction } from '../services/successionService.js'

const router = Router()
const createSchema = z.object({ module: z.enum(['performance','competency','learning','training','succession','recognition']), subjectEmployeeId: z.string().uuid().nullable().optional(), title: z.string().min(3).max(140), dueDate: z.string().datetime().nullable().optional(), metadata: z.record(z.unknown()).default({}) })
const bulkCreateSchema = z.object({
  module: z.enum(['performance', 'competency', 'learning', 'training', 'succession', 'recognition']),
  employeeIds: z.array(z.string().uuid()).min(1, 'At least one employee must be selected.'),
  cycleTitle: z.string().min(3).max(140),
  dueDate: z.string().datetime().nullable().optional(),
  skipExistingActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
})
const advanceSchema = z.object({ note: z.string().max(2000).optional(), data: z.record(z.unknown()).default({}), scores: z.object({ performanceScore: z.number().min(0).max(100).optional(), competencyScore: z.number().min(0).max(100).optional(), learningProgress: z.number().min(0).max(100).optional() }).optional() })
const noteSchema = z.object({ note: z.string().min(1).max(2000), data: z.record(z.unknown()).default({}) })
const returnSchema = z.object({ targetStage: z.string().optional(), note: z.string().max(2000).optional(), data: z.record(z.unknown()).default({}) })
const cancelSchema = z.object({ reason: z.string().min(1).max(2000), data: z.record(z.unknown()).default({}) })
const dueDateSchema = z.object({ dueDate: z.string().datetime() })
const overdueQuerySchema = z.object({ days: z.coerce.number().int().positive().default(3) })
import { sendEmail } from '../services/email.js'

export async function resolveNextOwners(client, workflow, destination) {
  const recipientMap = new Map()

  // 1. Fetch subject employee info if available
  let subjectEmp = null
  if (workflow?.subject_employee_id) {
    const empRes = await client.query(
      'SELECT id, full_name, department, manager_id FROM employees WHERE id = $1',
      [workflow.subject_employee_id]
    )
    subjectEmp = empRes.rows[0] || null
  }

  // 2. Resolve recipients for each role in destination.roles
  for (const role of destination.roles) {
    if (role === 'employee') {
      if (workflow?.subject_employee_id) {
        // ONLY the subject employee of the workflow is notified
        const empUser = await client.query(
          'SELECT id, email, full_name FROM users WHERE employee_id = $1 AND is_active = true',
          [workflow.subject_employee_id]
        )
        for (const u of empUser.rows) {
          recipientMap.set(u.id, u)
        }
      }
    } else if (role === 'supervisor') {
      let foundSupervisor = false
      if (subjectEmp) {
        // a) Direct manager if active user
        if (subjectEmp.manager_id) {
          const mgrUser = await client.query(
            'SELECT id, email, full_name FROM users WHERE employee_id = $1 AND is_active = true',
            [subjectEmp.manager_id]
          )
          for (const u of mgrUser.rows) {
            recipientMap.set(u.id, u)
            foundSupervisor = true
          }
        }
        // b) Supervisors in the employee's assigned department
        if (subjectEmp.department) {
          const deptSupers = await client.query(
            `SELECT u.id, u.email, u.full_name
             FROM users u
             JOIN employees e ON e.id = u.employee_id
             WHERE u.role = 'supervisor' AND e.department = $1 AND u.is_active = true`,
            [subjectEmp.department]
          )
          for (const u of deptSupers.rows) {
            recipientMap.set(u.id, u)
            foundSupervisor = true
          }
        }
      }
      // Fallback: If no subject employee or no department supervisor was found
      if (!foundSupervisor) {
        const allSupers = await client.query(
          "SELECT id, email, full_name FROM users WHERE role = 'supervisor' AND is_active = true"
        )
        for (const u of allSupers.rows) {
          recipientMap.set(u.id, u)
        }
      }
    } else {
      // hr, management, operations_manager
      const roleUsers = await client.query(
        'SELECT id, email, full_name FROM users WHERE role = $1 AND is_active = true',
        [role]
      )
      for (const u of roleUsers.rows) {
        recipientMap.set(u.id, u)
      }
    }
  }

  return Array.from(recipientMap.values())
}

async function notifyNextOwners(client, workflow, destination) {
  const recipients = await resolveNextOwners(client, workflow, destination)
  const title = `${workflow.module[0].toUpperCase()}${workflow.module.slice(1)}: Action Required`
  const message = `${destination.label} is ready for your action: "${workflow.title}".`

  for (const recipient of recipients) {
    await client.query('INSERT INTO notifications(user_id, workflow_id, title, message) VALUES($1,$2,$3,$4)', [recipient.id, workflow.id, title, message])
    if (recipient.email) {
      // Dispatch email asynchronously
      sendEmail({
        to: recipient.email,
        subject: title,
        text: message,
        details: [
          ['Workflow', workflow.title],
          ['Module', workflow.module.toUpperCase()],
          ['Stage', destination.label],
        ],
        actionUrl: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/${workflow.module}`,
        actionText: `Open ${destination.label}`,
      }).catch(err => console.warn('[PHS EMAIL] Notification dispatch error:', err.message))
    }
  }
}
router.use(authenticate)

router.get('/definitions', (_req, res) => res.json({ workflows: Object.fromEntries(Object.entries({ performance: stagesFor('performance'), competency: stagesFor('competency'), learning: stagesFor('learning'), training: stagesFor('training'), succession: stagesFor('succession'), recognition: stagesFor('recognition') }).map(([module, stages]) => [module, stages.map(([key, label, roles]) => ({ key, label, roles }))])) }))

router.get('/subjects', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE is_active=true'
    if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND department=$${params.length}`
    } else if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND id=$${params.length}`
    }
    const { rows } = await query(`SELECT id, full_name, department, job_title FROM employees ${where} ORDER BY full_name`, params)
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const { module, status = 'active', page = '1', limit = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))
    const offset = (pageNum - 1) * limitNum
    const params = []; let where = 'WHERE w.status = $1'; params.push(status)
    if (module) { params.push(module); where += ` AND w.module = $${params.length}` }
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND w.subject_employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const countResult = await query(`SELECT count(*)::int AS total FROM workflows w LEFT JOIN employees e ON e.id = w.subject_employee_id ${where}`, params)
    const total = countResult.rows[0]?.total || 0
    params.push(limitNum, offset)
    const { rows } = await query(`SELECT w.*, e.full_name AS subject_name, e.department AS subject_department FROM workflows w LEFT JOIN employees e ON e.id = w.subject_employee_id ${where} ORDER BY w.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    res.json({ workflows: rows, total, page: pageNum, limit: limitNum })
  } catch (error) { next(error) }
})

router.get('/:id/competency-comparison', async (req, res, next) => {
  try {
    const workflow = await verifyWorkflowAccess(req.user, req.params.id)
    const comparison = await getCompetencyComparison({ query }, workflow.subject_employee_id)
    res.json({ comparison })
  } catch (error) { next(error) }
})

router.get('/competency-comparison/employee/:employeeId', async (req, res, next) => {
  try {
    const employee = await verifyEmployeeAccess(req.user, req.params.employeeId)
    const comparison = await getCompetencyComparison({ query }, employee.id)
    res.json({ comparison })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body); const [initialStage] = stagesFor(input.module)
    if (!initialStage[2].includes(req.user.role)) return res.status(403).json({ error: 'Your role cannot start this workflow.' })
    const subjectEmployeeId = input.subjectEmployeeId || (req.user.role === 'employee' ? req.user.employeeId : null)
    if (subjectEmployeeId) {
      await verifyEmployeeAccess(req.user, subjectEmployeeId)
    }
    const { rows } = await query('INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, due_date, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [input.module, input.title, subjectEmployeeId, initialStage[0], req.user.sub, input.dueDate || null, input.metadata])
    await query('INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, details) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, initialStage[0], 'created', req.user.sub, input.metadata])
    await logActivity({ req, user: req.user, action: 'workflow.create', category: 'workflow', targetId: rows[0].id, description: `${req.user.name} created ${input.module} workflow "${input.title}"`, details: { module: input.module, subjectEmployeeId: subjectEmployeeId || null } })
    res.status(201).json({ workflow: rows[0] })
  } catch (error) { next(error) }
})

router.post('/bulk', authorize('hr', 'supervisor', 'operations_manager'), async (req, res, next) => {
  try {
    const input = bulkCreateSchema.parse(req.body)
    const [initialStage] = stagesFor(input.module)
    if (!initialStage[2].includes(req.user.role) && req.user.role !== 'hr') {
      return res.status(403).json({ error: 'Your role cannot initiate this workflow cycle.' })
    }

    const result = await transaction(async (client) => {
      const empRes = await client.query(
        'SELECT id, full_name, department, job_title FROM employees WHERE id = ANY($1::uuid[]) AND is_active = true',
        [input.employeeIds]
      )
      const employees = empRes.rows
      if (!employees.length) {
        throw Object.assign(new Error('No active employees found matching the selection.'), { status: 400 })
      }

      for (const emp of employees) {
        await verifyEmployeeAccess(req.user, emp.id)
      }

      let activeSubjectIds = new Set()
      if (input.skipExistingActive) {
        const activeRes = await client.query(
          'SELECT subject_employee_id FROM workflows WHERE module = $1 AND status = $2 AND subject_employee_id = ANY($3::uuid[])',
          [input.module, 'active', input.employeeIds]
        )
        activeSubjectIds = new Set(activeRes.rows.map(r => r.subject_employee_id))
      }

      const created = []
      const skipped = []
      const stageDestination = { key: initialStage[0], label: initialStage[1], roles: initialStage[2] }

      for (const emp of employees) {
        if (activeSubjectIds.has(emp.id)) {
          skipped.push({
            id: emp.id,
            fullName: emp.full_name,
            department: emp.department,
            reason: 'Active workflow already exists in this module',
          })
          continue
        }

        const title = `${input.cycleTitle} - ${emp.full_name}`
        const meta = {
          ...input.metadata,
          cycleTitle: input.cycleTitle,
          launchedInBulk: true,
          launchedAt: new Date().toISOString(),
        }

        const wfRes = await client.query(
          'INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, due_date, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [input.module, title, emp.id, initialStage[0], req.user.sub, input.dueDate || null, meta]
        )
        const wf = wfRes.rows[0]

        await client.query(
          'INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, details) VALUES ($1,$2,$3,$4,$5)',
          [wf.id, initialStage[0], 'created', req.user.sub, meta]
        )

        await notifyNextOwners(client, wf, stageDestination)

        created.push({
          id: wf.id,
          title: wf.title,
          subjectEmployeeId: emp.id,
          subjectName: emp.full_name,
          department: emp.department,
          stage: wf.current_stage,
        })
      }

      return { created, skipped }
    })

    if (result.created.length > 0) {
      await logActivity({
        req,
        user: req.user,
        action: 'workflow.bulk_create',
        category: 'workflow',
        description: `${req.user.name} launched review cycle "${input.cycleTitle}" (${result.created.length} created, ${result.skipped.length} skipped)`,
        details: {
          module: input.module,
          cycleTitle: input.cycleTitle,
          createdCount: result.created.length,
          skippedCount: result.skipped.length,
          totalRequested: input.employeeIds.length,
        },
      })
    }

    res.status(201).json({
      success: true,
      cycleTitle: input.cycleTitle,
      module: input.module,
      createdCount: result.created.length,
      skippedCount: result.skipped.length,
      totalCount: input.employeeIds.length,
      createdWorkflows: result.created,
      skippedEmployees: result.skipped,
    })
  } catch (error) {
    next(error)
  }
})

const assignGapSchema = z.object({
  subjectEmployeeId: z.string().uuid(),
  courseTitle: z.string().min(2).max(140),
  competencyName: z.string().optional(),
  gapScore: z.number().optional(),
})

router.post('/assign-learning-gap', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = assignGapSchema.parse(req.body)
    await verifyEmployeeAccess(req.user, input.subjectEmployeeId)
    const [initialStage] = stagesFor('learning')
    const title = `Learning Path: ${input.courseTitle}`
    const metadata = {
      courseTitle: input.courseTitle,
      assignedFromCompetencyGap: true,
      competencyName: input.competencyName || '',
      gapScore: input.gapScore || 0,
      assignedBy: req.user.sub,
    }
    const result = await transaction(async client => {
      const employee = await client.query('SELECT id, full_name FROM employees WHERE id=$1 AND is_active=true', [input.subjectEmployeeId])
      if (!employee.rows[0]) throw Object.assign(new Error('Employee not found or inactive.'), { status: 404 })

      // Reuse an existing library resource with the matching title, or create a
      // real learning_resource so the Learning module genuinely tracks it.
      let resource = (await client.query('SELECT * FROM learning_resources WHERE title=$1 AND is_active=true LIMIT 1', [input.courseTitle])).rows[0]
      if (!resource) {
        const inserted = await client.query(
          `INSERT INTO learning_resources (title, description, category, provider, provider_type, duration_hours, objectives, url, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [input.courseTitle, `Assigned to resolve the skill gap in ${input.competencyName || 'Competency'}.`, 'Skill Development', 'Company Training', 'internal', 4, '', '', req.user.sub],
        )
        resource = inserted.rows[0]
        if (input.competencyName) {
          await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2) ON CONFLICT DO NOTHING', [resource.id, input.competencyName])
        }
      }

      // Create/link a real learning_assignment for the employee so the Learning
      // module shows the course and can track progress + verified completion.
      await client.query(
        `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, status, progress)
         VALUES ($1,$2,$3,'not_started',0)
         ON CONFLICT (resource_id, employee_id) DO UPDATE SET assigned_by=EXCLUDED.assigned_by, status='not_started', progress=0`,
        [resource.id, employee.rows[0].id, req.user.sub],
      )

      // Immediately update employee's aggregate learning_progress average
      await client.query(
        `UPDATE employees
         SET learning_progress = (
           SELECT COALESCE(ROUND(AVG(progress)), 0)
           FROM learning_assignments
           WHERE employee_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [employee.rows[0].id],
      )

      const { rows } = await client.query(
        'INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        ['learning', title, input.subjectEmployeeId, initialStage[0], req.user.sub, metadata]
      )
      await client.query(
        'INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details) VALUES ($1,$2,$3,$4,$5,$6)',
        [rows[0].id, initialStage[0], 'created', req.user.sub, `Assigned to resolve skill gap in ${input.competencyName || 'Competency'}`, metadata]
      )
      return { workflow: rows[0], resource }
    })
    await logActivity({ req, user: req.user, action: 'workflow.assign_learning_gap', category: 'workflow', targetId: result.workflow.id, description: `${req.user.name} assigned learning path "${input.courseTitle}" to resolve a skill gap`, details: { subjectEmployeeId: input.subjectEmployeeId, competencyName: input.competencyName } })
    res.status(201).json({ workflow: result.workflow, resource: result.resource, assigned: true })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const workflow = await verifyWorkflowAccess(req.user, req.params.id)
    const events = await query('SELECT we.*, u.full_name AS actor_name FROM workflow_events we JOIN users u ON u.id=we.actor_id WHERE workflow_id=$1 ORDER BY created_at ASC', [req.params.id])
    res.json({ workflow, events: events.rows, stages: stagesFor(workflow.module).map(([key,label,roles]) => ({ key,label,roles })) })
  } catch (error) { next(error) }
})

// GET /:id/ai-reports - fetch saved AI reports linked to a workflow (audit trail)
router.get('/:id/ai-reports', async (req, res, next) => {
  try {
    await verifyWorkflowAccess(req.user, req.params.id)
    const reports = await getReportsForWorkflow(req.params.id)
    res.json({ reports })
  } catch (error) { next(error) }
})

// POST /:id/generate-report - Generate an AI report on demand for a completed workflow.
router.post('/:id/generate-report', authorize('hr', 'supervisor', 'employee'), async (req, res, next) => {
  try {
    const workflow = await verifyWorkflowAccess(req.user, req.params.id)
    const report = await generateOnDemand(req.params.id, req.user.sub)
    await logActivity({ req, user: req.user, action: 'workflow.report_generate', category: 'workflow', targetId: req.params.id, description: `${req.user.name} generated an AI report for workflow "${workflow.title}"` })
    res.status(201).json({ report })
  } catch (error) { next(error) }
})

router.post('/:id/notes', async (req, res, next) => {
  try {
    const input = noteSchema.parse(req.body)
    const workflow = await verifyWorkflowAccess(req.user, req.params.id)
    const currentStage = stagesFor(workflow.module).find(([key]) => key === workflow.current_stage)
    // Allow the workflow subject to add notes on employee-assigned stages so
    // their self-assessment submission isn't blocked server-side.
    if (!canActOnStage(currentStage?.[2] || [], req.user.role, workflow.subject_employee_id, req.user.employeeId)) {
      return res.status(403).json({ error: `This workflow action is assigned to ${currentStage?.[2].join(' or ') || 'another role'}.` })
    }
    if (input.data?.type === 'training_schedule' && req.user.role !== 'hr') return res.status(403).json({ error: 'Only HR can record a verified training schedule.' })
    await query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'note', req.user.sub, input.note, input.data])
    await query('UPDATE workflows SET updated_at=NOW() WHERE id=$1', [workflow.id])
    await logActivity({ req, user: req.user, action: 'workflow.note', category: 'workflow', targetId: workflow.id, description: `${req.user.name} added a note to workflow "${workflow.title}"`, details: { stage: workflow.current_stage } })
    res.status(201).json({ saved: true })
  } catch (error) { next(error) }
})

router.post('/:id/return', async (req, res, next) => {
  try {
    const input = returnSchema.parse(req.body)
    await verifyWorkflowAccess(req.user, req.params.id)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
      const destination = returnToStage(workflow.module, workflow.current_stage, req.user.role, input.targetStage, workflow.subject_employee_id, req.user.employeeId)
      const update = await client.query('UPDATE workflows SET current_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [destination.key, workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, destination.key, 'returned', req.user.sub, input.note || null, { ...input.data, returnedFrom: workflow.current_stage, targetStage: destination.key }])
      await notifyNextOwners(client, workflow, destination)
      return { workflow: update.rows[0], returnedTo: destination.label }
    })
    await logActivity({ req, user: req.user, action: 'workflow.return', category: 'workflow', targetId: req.params.id, description: `${req.user.name} returned workflow to ${result.returnedTo}`, details: { note: input.note || null } })
    res.json(result)
  } catch (error) { next(error) }
})

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const input = cancelSchema.parse(req.body)
    await verifyWorkflowAccess(req.user, req.params.id)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
      const isCreator = req.user.sub === workflow.created_by
      const isHr = req.user.role === 'hr'
      if (!isCreator && !isHr) throw Object.assign(new Error('Only the workflow owner or HR can cancel this workflow.'), { status: 403 })
      await client.query("UPDATE workflows SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE id=$1", [workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'cancelled', req.user.sub, input.reason, input.data])
      return { cancelled: true, stage: workflow.current_stage }
    })
    await logActivity({ req, user: req.user, action: 'workflow.cancel', category: 'workflow', targetId: req.params.id, description: `${req.user.name} cancelled a workflow`, details: { reason: input.reason } })
    res.json(result)
  } catch (error) { next(error) }
})

router.post('/:id/advance', async (req, res, next) => {
  try {
    const input = advanceSchema.parse(req.body)
    await verifyWorkflowAccess(req.user, req.params.id)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
      const destination = nextStage(workflow.module, workflow.current_stage, req.user.role, workflow.subject_employee_id, req.user.employeeId)
      if (!destination) {
        if (workflow.module === 'succession') {
          const form = (input.data?.formData && typeof input.data.formData === 'object') ? input.data.formData : input.data || {}
          const targetPos = input.data?.targetPosition || form.targetPosition || form.recommendedPosition || form.targetRole || workflow.metadata?.recommendedPosition || workflow.metadata?.targetRole || form.selectedPosition
          if (!targetPos) {
            throw Object.assign(new Error('A valid target position must be specified to approve succession.'), { status: 400 })
          }
          const successionResult = await approveSuccessionTransaction(client, {
            workflowId: workflow.id,
            employeeId: workflow.subject_employee_id,
            targetPosition: targetPos,
            actorUser: req.user,
            note: input.note || form.notes || 'Approved Succession',
            effectiveDate: input.data?.effectiveDate || form.effectiveDate,
          })

          const completedWf = await client.query('SELECT * FROM workflows WHERE id = $1', [workflow.id])
          return {
            completed: true,
            stage: workflow.current_stage,
            workflow: completedWf.rows[0],
            employee: successionResult.employee,
            positionHistory: successionResult.positionHistory,
            successionRecord: successionResult.successionRecord,
            successionApproved: true,
            metricsReady: true,
          }
        }

        const eventResult = await client.query('SELECT * FROM workflow_events WHERE workflow_id=$1 ORDER BY created_at ASC', [workflow.id])
        const writeBack = await applyWorkflowScoreWriteBack(client, workflow, eventResult.rows, input.data, input.scores, req.user.sub)
        const completionDetails = {
          ...input.data,
          ...(writeBack.scoreWriteBack ? { scoreWriteBack: writeBack.scoreWriteBack } : {}),
        }
        const completedWorkflow = await client.query(
          "UPDATE workflows SET status='completed', completed_at=NOW(), updated_at=NOW(), metadata=metadata || $2::jsonb WHERE id=$1 RETURNING *",
          [workflow.id, writeBack.scoreWriteBack ? { finalResult: writeBack.scoreWriteBack } : {}],
        )
        await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'completed', req.user.sub, input.note || null, completionDetails])

        // Auto-assign learning courses/workflows for any detected competency gaps
        let gapAssignments = []
        if (['competency', 'performance'].includes(workflow.module) && workflow.subject_employee_id) {
          try {
            gapAssignments = await autoAssignGapLearning(client, workflow.subject_employee_id, req.user.sub)
          } catch (gapErr) {
            console.warn('[workflows] autoAssignGapLearning error:', gapErr.message)
          }
        }

        // AI-assisted analytics: calculate and save the module metrics so the
        // UI can show a "Ready to Generate AI Report" state. The AI report is
        // NOT generated automatically — HR generates it on demand via
        // POST /:id/generate-report. Metrics use the same transaction client
        // so the saved preview includes the score that was just written back.
        try {
          const { metrics } = await calculateMetrics(workflow.module, {}, client)
          await saveMetricsForWorkflow(client, completedWorkflow.rows[0], req.user.sub, metrics)
          return { completed: true, stage: workflow.current_stage, workflow: completedWorkflow.rows[0], employee: writeBack.employee, scoreWriteBack: writeBack.scoreWriteBack, gapAssignments, metricsReady: true }
        } catch (aiError) {
          console.warn('[workflows] Could not save metrics for workflow completion:', aiError.message)
          return { completed: true, stage: workflow.current_stage, workflow: completedWorkflow.rows[0], employee: writeBack.employee, scoreWriteBack: writeBack.scoreWriteBack, gapAssignments, metricsReady: false }
        }
      }
      const metaPatch = input.data ? JSON.stringify(input.data.assessment ? { assessment: input.data.assessment, nomination: input.data } : { lastStepData: input.data }) : '{}'
      const update = await client.query(
        'UPDATE workflows SET current_stage=$1, updated_at=NOW(), metadata = COALESCE(metadata, \'{}\'::jsonb) || $3::jsonb WHERE id=$2 RETURNING *',
        [destination.key, workflow.id, metaPatch]
      )
      // Store the event under workflow.current_stage (the stage being completed/submitted)
      // so that CalibrationBuilder can find self_assessment data by searching stage='self_assessment'
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'advanced', req.user.sub, input.note || null, input.data])
      await notifyNextOwners(client, workflow, destination)
      return { workflow: update.rows[0], nextAction: destination.label }
    })
    if (result.completed) {
      await logActivity({ req, user: req.user, action: 'workflow.complete', category: 'workflow', targetId: req.params.id, description: `${req.user.name} completed a workflow`, details: { note: input.note || null } })
    } else {
      await logActivity({ req, user: req.user, action: 'workflow.advance', category: 'workflow', targetId: req.params.id, description: `${req.user.name} advanced workflow to ${result.nextAction}`, details: { note: input.note || null } })
    }
    res.json(result)
  } catch (error) { next(error) }
})

// POST /:id/due-date - set or update the due date on a workflow
router.post('/:id/due-date', async (req, res, next) => {
  try {
    const input = dueDateSchema.parse(req.body)
    await verifyWorkflowAccess(req.user, req.params.id)
    const updated = await query('UPDATE workflows SET due_date=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [input.dueDate, req.params.id])
    await logActivity({ req, user: req.user, action: 'workflow.due_date', category: 'workflow', targetId: req.params.id, description: `${req.user.name} set due date on workflow`, details: { dueDate: input.dueDate } })
    res.json({ workflow: updated.rows[0] })
  } catch (error) { next(error) }
})

// GET /overdue - list workflows that are past their due date
router.get('/overdue', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const input = overdueQuerySchema.parse(req.query)
    const params = []
    let where = "WHERE w.due_date IS NOT NULL AND w.due_date < NOW() AND w.status = 'active'"
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND w.subject_employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(`SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id=w.subject_employee_id ${where} ORDER BY w.due_date ASC`, params)
    res.json({ workflows: rows, overdueCount: rows.length })
  } catch (error) { next(error) }
})
export default router
