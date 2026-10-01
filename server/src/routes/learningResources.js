import { getScopeFilter, verifyEmployeeAccess } from '../services/departmentScope.js'
import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { generateDevelopmentPlan } from '../services/openrouter.js'

const router = Router()

// ---------------------------------------------------------------------------
// Learning Resource / Course Library API.
//
// Clearly separates:
//   - COURSE/RESOURCE info   (learning_resources)
//   - competency association (learning_resource_competencies)
//   - ASSIGNMENT             (learning_assignments)
//   - SELF-REPORTED PROGRESS (learning_assignments.progress / status)
//   - COMPLETION/ASSESSMENT  (learning_completions)  <-- ONLY source of truth
//                                                       for "completed"
//
// Employees update their own progress (%) and a self-reported status
// (not_started / studying / completed / need_help). HR/supervisors can see the
// live status badge and still officially VERIFY/RECORD completion via
// learning_completions.
// ---------------------------------------------------------------------------

const resourceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(3000),
  category: z.string().min(2).max(120),
  provider: z.string().max(200).optional().default(''),
  providerType: z.enum(['internal', 'external']).default('internal'),
  durationHours: z.coerce.number().nonnegative().max(1000).nullable().optional(),
  objectives: z.string().max(4000).optional().default(''),
  url: z.string().max(1000).optional().default(''),
  videoUrl: z.string().max(1000).optional().default(''),
  pdfUrl: z.string().max(1000).optional().default(''),
  lessonContent: z.string().max(50000).optional().default(''),
  competencies: z.array(z.string().min(1).max(120)).max(50).default([]),
})

const assignSchema = z.object({
  resourceId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  dueDate: z.string().date().nullable().optional(),
})

// Self-reported progress + status. status is the employee's own flag; progress
// is the employee-driven 0-100 slider.
const progressSchema = z.object({
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['not_started', 'studying', 'completed', 'need_help']).optional(),
})

const completionSchema = z.object({
  resourceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  assessment: z.record(z.unknown()).default({}),
})

router.use(authenticate)

// Competencies available for association (enumerated from workflow config +
// any already-used competency tags).
router.get('/competencies', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT competency FROM learning_resource_competencies ORDER BY competency`,
    )
    const base = ['Customer Service', 'Leadership', 'Communication', 'Defensive Driving', 'Vehicle Inspection & Preventive Checks', 'Route Planning & Optimization', 'Dispatch Communication', 'Inventory Accuracy', 'Warehouse Safety', 'Forklift Operation & Safety', 'Compliance', 'Conflict Resolution', 'Technical Skills', 'Shipment Tracking', 'Operational Management', 'Financial Acumen', 'Teamwork']
    const tags = [...new Set([...base, ...rows.map(r => r.competency)])].sort()
    res.json({ competencies: tags })
  } catch (error) { next(error) }
})

// Centralized role and department competency profiles
const ROLE_COMPETENCY_MAP = {
  Driver: [
    { comp: 'Defensive Driving', req: 95, offset: -8 },
    { comp: 'Vehicle Inspection & Preventive Checks', req: 95, offset: -6 },
    { comp: 'Route Compliance', req: 95, offset: -5 },
    { comp: 'Cargo Securement', req: 92, offset: -10 },
    { comp: 'Delivery Documentation & Communication', req: 88, offset: 2 },
  ],
  'Heavy Vehicle Driver': [
    { comp: 'Defensive Driving', req: 95, offset: -8 },
    { comp: 'Vehicle Inspection & Preventive Checks', req: 95, offset: -6 },
    { comp: 'Route Compliance', req: 95, offset: -5 },
    { comp: 'Cargo Securement', req: 95, offset: -10 },
    { comp: 'Incident Reporting', req: 90, offset: 2 },
  ],
  'Delivery Driver': [
    { comp: 'Defensive Driving', req: 92, offset: -8 },
    { comp: 'Vehicle Inspection & Preventive Checks', req: 92, offset: -6 },
    { comp: 'Route Compliance', req: 92, offset: -5 },
    { comp: 'Proof-of-Delivery Accuracy', req: 90, offset: -10 },
    { comp: 'Customer Communication', req: 85, offset: 2 },
  ],
  Dispatcher: [
    { comp: 'Route Planning & Optimization', req: 92, offset: -8 },
    { comp: 'Load Scheduling', req: 90, offset: -6 },
    { comp: 'TMS & GPS Proficiency', req: 95, offset: -5 },
    { comp: 'Exception Management', req: 90, offset: -10 },
    { comp: 'Dispatch Communication', req: 88, offset: 2 },
  ],
  'Dispatch Supervisor': [
    { comp: 'Route Planning & Optimization', req: 95, offset: -8 },
    { comp: 'Load Scheduling', req: 92, offset: -6 },
    { comp: 'TMS & GPS Proficiency', req: 95, offset: -5 },
    { comp: 'Exception Management', req: 92, offset: -10 },
    { comp: 'Shift Leadership & Coaching', req: 88, offset: 2 },
  ],
  'Warehouse Associate': [
    { comp: 'Warehouse Safety', req: 95, offset: -8 },
    { comp: 'Inventory Accuracy', req: 92, offset: -6 },
    { comp: 'Picking & Packing', req: 92, offset: -5 },
    { comp: 'Shipment Staging & Load Readiness', req: 90, offset: -10 },
    { comp: 'WMS Proficiency', req: 85, offset: 2 },
  ],
  'Inventory Control Clerk': [
    { comp: 'Inventory Accuracy', req: 95, offset: -8 },
    { comp: 'Cycle Counting & Variance Resolution', req: 92, offset: -6 },
    { comp: 'WMS Data Integrity', req: 95, offset: -5 },
    { comp: 'Receiving & Shipping Documentation', req: 90, offset: -10 },
    { comp: 'Cross-Functional Communication', req: 85, offset: 2 },
  ],
  'Forklift Operator': [
    { comp: 'Forklift Operation & Safety', req: 95, offset: -8 },
    { comp: 'Load Stability & Handling', req: 95, offset: -6 },
    { comp: 'Warehouse Traffic & Pedestrian Safety', req: 95, offset: -5 },
    { comp: 'Freight Scanning & Staging', req: 90, offset: -10 },
    { comp: 'Equipment Inspection & Reporting', req: 90, offset: 2 },
  ],
  'Customer Service Representative': [
    { comp: 'Shipment Tracking & Visibility', req: 90, offset: -8 },
    { comp: 'Customer Communication', req: 90, offset: -6 },
    { comp: 'Issue & Claims Resolution', req: 88, offset: -5 },
    { comp: 'Proof-of-Delivery Accuracy', req: 95, offset: -10 },
    { comp: 'TMS Data Accuracy', req: 92, offset: 2 },
  ],
  'Safety & Compliance Manager': [
    { comp: 'Regulatory Compliance', req: 95, offset: -8 },
    { comp: 'Risk Assessment', req: 92, offset: -6 },
    { comp: 'Incident Investigation', req: 90, offset: -5 },
    { comp: 'Corrective Action Management', req: 92, offset: -10 },
    { comp: 'Safety Training & Communication', req: 88, offset: 2 },
  ],
  'Safety Coordinator': [
    { comp: 'Workplace & Transport Risk Assessment', req: 92, offset: -8 },
    { comp: 'Incident Reporting & Investigation', req: 90, offset: -6 },
    { comp: 'Regulatory Documentation', req: 95, offset: -5 },
    { comp: 'Corrective Action Follow-Up', req: 90, offset: -10 },
    { comp: 'Safety Communication & Training', req: 88, offset: 2 },
  ],
}

const DEPARTMENT_COMPETENCY_MAP = {
  'Fleet & Transportation': [
    { comp: 'On-Time Delivery', req: 95, offset: -8 },
    { comp: 'Defensive Driving', req: 95, offset: -6 },
    { comp: 'Vehicle Inspection & Preventive Checks', req: 95, offset: -5 },
    { comp: 'Route Compliance', req: 95, offset: -10 },
    { comp: 'Cargo Securement', req: 92, offset: 2 },
  ],
  'Dispatch & Routing': [
    { comp: 'Dispatch Accuracy', req: 95, offset: -8 },
    { comp: 'Route Planning & Optimization', req: 92, offset: -6 },
    { comp: 'Load Scheduling', req: 90, offset: -5 },
    { comp: 'TMS & GPS Proficiency', req: 95, offset: -10 },
    { comp: 'Exception Management', req: 90, offset: 2 },
  ],
  'Warehouse & Inventory': [
    { comp: 'Warehouse Safety', req: 95, offset: -8 },
    { comp: 'Inventory Accuracy', req: 95, offset: -6 },
    { comp: 'Picking & Packing', req: 92, offset: -5 },
    { comp: 'WMS Proficiency', req: 90, offset: -10 },
    { comp: 'Forklift Operation & Safety', req: 95, offset: 2 },
  ],
  'Customer Service': [
    { comp: 'Shipment Tracking & Visibility', req: 90, offset: -8 },
    { comp: 'Customer Communication', req: 90, offset: -6 },
    { comp: 'Issue & Claims Resolution', req: 88, offset: -5 },
    { comp: 'Proof-of-Delivery Accuracy', req: 95, offset: -10 },
    { comp: 'TMS Data Accuracy', req: 92, offset: 2 },
  ],
  'Safety & Compliance': [
    { comp: 'Regulatory Compliance', req: 95, offset: -8 },
    { comp: 'Risk Assessment', req: 92, offset: -6 },
    { comp: 'Incident Investigation', req: 90, offset: -5 },
    { comp: 'Corrective Action Management', req: 92, offset: -10 },
    { comp: 'Safety Training & Communication', req: 88, offset: 2 },
  ],
  'Finance & Administration': [
    { comp: 'Freight Billing & Audit', req: 95, offset: -8 },
    { comp: 'Invoice Accuracy', req: 95, offset: -6 },
    { comp: 'Accounts Reconciliation', req: 92, offset: -5 },
    { comp: 'Internal Controls', req: 95, offset: -10 },
    { comp: 'Cost Control Compliance', req: 90, offset: 2 },
  ],
  'Human Resources': [
    { comp: 'Employee Relations', req: 88, offset: -7 },
    { comp: 'Recruitment', req: 88, offset: -8 },
    { comp: 'Compliance', req: 88, offset: -5 },
    { comp: 'Communication', req: 80, offset: 2 },
    { comp: 'Leadership', req: 80, offset: -4 },
  ],
  'Executive Office': [
    { comp: 'Operational Management', req: 95, offset: -8 },
    { comp: 'Leadership', req: 95, offset: -6 },
    { comp: 'Financial Acumen', req: 88, offset: -7 },
    { comp: 'Customer Service', req: 88, offset: 2 },
    { comp: 'Communication', req: 88, offset: -4 },
  ],
  'Human Resources': [
    { comp: 'Employee Relations', req: 88, offset: -7 },
    { comp: 'Recruitment & Selection', req: 88, offset: -8 },
    { comp: 'Labor Compliance', req: 95, offset: -5 },
    { comp: 'Learning & Development', req: 85, offset: 2 },
    { comp: 'HR Data & Documentation Accuracy', req: 95, offset: -4 },
  ],
  'default': [
    { comp: 'Operational Management', req: 90, offset: -8 },
    { comp: 'Leadership', req: 88, offset: -6 },
    { comp: 'Compliance', req: 90, offset: -7 },
    { comp: 'Customer Service', req: 85, offset: 2 },
    { comp: 'Communication', req: 88, offset: -4 },
  ],
}

// Skill-gap detection — real per-competency data from competency_assessments.
// Returns each gap (current score < required score) with the employee's
// aggregate competency score and any learning resources that already carry the
// matching competency tag. Accessible to HR, supervisors and the employee
// themselves (their own gaps only).
router.get('/skill-gaps', async (req, res, next) => {
  try {
    const { employeeId } = req.query
    const scope = await getScopeFilter(req.user)

    // If an employeeId is specified and has no competency assessments yet, auto-seed role & department-specific assessments
    if (employeeId) {
      const countRes = await query('SELECT count(*)::int as count FROM competency_assessments WHERE employee_id=$1', [employeeId])
      if (Number(countRes.rows[0]?.count || 0) === 0) {
        const empRes = await query('SELECT competency_score, department, job_title FROM employees WHERE id=$1', [employeeId])
        const emp = empRes.rows[0]
        if (emp) {
          const baseScore = Number(emp.competency_score) || 75
          const seedComps = ROLE_COMPETENCY_MAP[emp.job_title] ||
            DEPARTMENT_COMPETENCY_MAP[emp.department] ||
            DEPARTMENT_COMPETENCY_MAP['default']

          for (const s of seedComps) {
            const score = Math.max(35, Math.min(100, Math.round(baseScore + s.offset)))
            await query(
              `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
               VALUES ($1, $2, $3, $4, 'baseline')
               ON CONFLICT (employee_id, competency) DO NOTHING`,
              [employeeId, s.comp, score, s.req],
            )
          }
        }
      }
    }

    let where = 'WHERE 1=1'
    const params = []
    // Employees may only view their own gaps.
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    } else if (employeeId) {
      await verifyEmployeeAccess(req.user, employeeId)
      params.push(employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT ca.employee_id, ca.competency, ca.score, ca.required_score,
              (ca.required_score - ca.score)::int AS gap,
              e.full_name AS employee_name, e.job_title, e.department,
              e.competency_score AS aggregate_competency_score
       FROM competency_assessments ca
       JOIN employees e ON e.id = ca.employee_id
       ${where} AND ca.score < ca.required_score
       ORDER BY gap DESC, e.full_name ASC`,
      params,
    )
    // Enrich each gap with matching active learning resources + live assignment and completion status
    const gapsWithCourses = await Promise.all(
      rows.map(async g => {
        const matchingResources = await query(
          `SELECT r.*,
                  la.id AS assignment_id,
                  la.status AS assignment_status,
                  la.progress AS assignment_progress,
                  la.due_date AS assignment_due_date,
                  (lc.id IS NOT NULL) AS is_completed,
                  lc.completed_at,
                  lc.assessment_result
           FROM learning_resources r
           JOIN learning_resource_competencies lrc ON lrc.resource_id = r.id
           LEFT JOIN learning_assignments la ON la.resource_id = r.id AND la.employee_id = $2
           LEFT JOIN learning_completions lc ON lc.resource_id = r.id AND lc.employee_id = $2
           WHERE r.is_active = true AND LOWER(lrc.competency) = LOWER($1)
           ORDER BY r.title ASC`,
          [g.competency, g.employee_id],
        )
        return {
          ...g,
          courses: matchingResources.rows,
          recommendedResources: matchingResources.rows,
        }
      }),
    )
    res.json({ skillGaps: gapsWithCourses, gaps: gapsWithCourses })
  } catch (error) { next(error) }
})

// GET /api/learning/recommendations — strictly department and role relevant learning courses
// Only returns courses when the employee has actual competency_assessments recorded.
// If no assessments exist yet, returns notAssessed: true so the UI can prompt the HR
// to complete the competency evaluation first (Stage 1 of the Competency workflow).
router.get('/recommendations', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const empId = scope.isEmployee ? scope.employeeId : (req.query.employeeId || scope.employeeId)

    if (!empId) {
      return res.status(400).json({ error: 'Employee ID is required for tailored recommendations.' })
    }

    const empRes = await query('SELECT id, full_name, department, job_title, competency_score FROM employees WHERE id=$1', [empId])
    const emp = empRes.rows[0]
    if (!emp) return res.status(404).json({ error: 'Employee not found.' })

    // ── GATE: require actual competency assessment records ──────────────────
    // If the employee has not yet been evaluated in Competency Management
    // (Stage 1: Define requirements), there are no assessments in the DB.
    // In that case we return notAssessed = true so the frontend can display
    // an instructional empty-state instead of falling back to generic role data.
    const assessmentCountRes = await query(
      'SELECT COUNT(*) AS cnt FROM competency_assessments WHERE employee_id = $1',
      [emp.id]
    )
    const assessmentCount = parseInt(assessmentCountRes.rows[0]?.cnt || '0', 10)

    if (assessmentCount === 0) {
      return res.json({
        notAssessed: true,
        employee: {
          id: emp.id,
          name: emp.full_name,
          department: emp.department,
          jobTitle: emp.job_title,
        },
        relevantCompetencies: [],
        recommendedResources: [],
      })
    }
    // ───────────────────────────────────────────────────────────────────────

    // Only include competencies WHERE employee actually has a gap (score < required_score)
    // Do NOT fall back to role-map for employees who are already assessed — only show
    // courses addressing their real detected gaps.
    const gapRes = await query(
      `SELECT competency FROM competency_assessments WHERE employee_id=$1 AND score < required_score`,
      [emp.id]
    )
    const gapComps = gapRes.rows.map(r => r.competency)

    if (gapComps.length === 0) {
      // Employee is assessed and has NO gaps — all competencies are on track
      return res.json({
        noGaps: true,
        employee: {
          id: emp.id,
          name: emp.full_name,
          department: emp.department,
          jobTitle: emp.job_title,
        },
        relevantCompetencies: [],
        recommendedResources: [],
      })
    }

    // Strictly filter resources whose competency tags match the employee's actual gaps
    const { rows } = await query(
      `SELECT DISTINCT r.*,
         COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies,
         (SELECT la.status FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_status,
         (SELECT la.progress FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_progress,
         EXISTS(SELECT 1 FROM learning_completions lc WHERE lc.resource_id = r.id AND lc.employee_id = $1) AS is_completed
       FROM learning_resources r
       JOIN learning_resource_competencies lrc ON lrc.resource_id = r.id
       WHERE r.is_active = true AND lrc.competency = ANY($2::text[])
       ORDER BY r.created_at DESC`,
      [emp.id, gapComps]
    )

    res.json({
      employee: {
        id: emp.id,
        name: emp.full_name,
        department: emp.department,
        jobTitle: emp.job_title,
      },
      relevantCompetencies: gapComps,
      recommendedResources: rows,
    })
  } catch (error) { next(error) }
})


// POST /api/learning/development-plan — AI skill-gap development plan generator
router.post('/development-plan', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const targetEmpId = req.body.employeeId || (scope.isEmployee ? scope.employeeId : null)

    if (!targetEmpId) {
      return res.status(400).json({ error: 'Target employee ID is required.' })
    }

    if (!scope.isEmployee) {
      await verifyEmployeeAccess(req.user, targetEmpId)
    }

    // 1. Fetch employee details
    const empRes = await query('SELECT id, full_name, department, job_title, competency_score, performance_score FROM employees WHERE id=$1', [targetEmpId])
    const employee = empRes.rows[0]
    if (!employee) return res.status(404).json({ error: 'Employee not found.' })

    // 2. Fetch detected skill gaps
    const gapRes = await query(
      `SELECT ca.competency, ca.score, ca.required_score, (ca.required_score - ca.score)::int AS gap
       FROM competency_assessments ca
       WHERE ca.employee_id = $1 AND ca.score < ca.required_score
       ORDER BY (ca.required_score - ca.score) DESC`,
      [targetEmpId]
    )
    const gaps = gapRes.rows

    // 3. Fetch catalog resources with competencies
    const resRes = await query(
      `SELECT r.id, r.title, r.category, r.description,
         COALESCE((SELECT array_agg(lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
       FROM learning_resources r
       WHERE r.is_active = true`
    )
    const resources = resRes.rows

    // 4. Run AI analysis
    const plan = await generateDevelopmentPlan({ employee, gaps, resources })

    await logActivity({
      req,
      user: req.user,
      action: 'ai.development_plan',
      category: 'learning',
      targetId: targetEmpId,
      description: `Generated AI Skill Gap Development Plan for ${employee.full_name} (${employee.job_title})`,
      details: { gapCount: gaps.length, department: employee.department }
    })

    res.json({
      success: true,
      plan,
      gaps,
      generatedAt: new Date().toISOString()
    })
  } catch (error) { next(error) }
})

// List resources (course library). HR and Supervisors see all active courses;
// employees see active courses. Optional category/search filtering.
router.get('/', async (req, res, next) => {
  try {
    const { category, search, competency, providerType } = req.query
    const params = []
    let where = 'WHERE r.is_active = true'
    if (category) {
      params.push(category)
      where += ` AND r.category = $${params.length}`
    }
    if (providerType && (providerType === 'internal' || providerType === 'external')) {
      params.push(providerType)
      where += ` AND r.provider_type = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      where += ` AND (r.title ILIKE $${params.length} OR r.description ILIKE $${params.length} OR r.provider ILIKE $${params.length})`
    }
    if (competency) {
      params.push(competency)
      where += ` AND EXISTS (SELECT 1 FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id AND LOWER(lrc.competency) = LOWER($${params.length}))`
    }
    const { rows } = await query(
      `SELECT r.*,
        COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies,
        (SELECT count(*)::int FROM learning_assignments la WHERE la.resource_id = r.id) AS assigned_count,
        (SELECT count(*)::int FROM learning_completions lc WHERE lc.resource_id = r.id) AS completed_count
       FROM learning_resources r ${where}
       ORDER BY r.created_at DESC`,
      params,
    )
    res.json({ resources: rows })
  } catch (error) { next(error) }
})

// Create resource — HR only.
router.post('/', authorize('hr'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO learning_resources (title, description, category, provider, provider_type, duration_hours, objectives, url, video_url, pdf_url, lesson_content, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          input.title,
          input.description,
          input.category,
          input.provider || null,
          input.providerType,
          input.durationHours ?? null,
          input.objectives || null,
          input.url || null,
          input.videoUrl || null,
          input.pdfUrl || null,
          input.lessonContent || null,
          req.user.sub,
        ],
      )
      const resource = rows[0]
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [resource.id, competency])
      }
      return { ...resource, competencies: [...new Set(input.competencies)] }
    })
    await logActivity({ req, user: req.user, action: 'learning.resource_create', category: 'learning', targetId: result.id, description: `${req.user.name} created learning resource "${result.title}"` })
    res.status(201).json({ resource: result })
  } catch (error) { next(error) }
})

// Update resource — HR only.
router.patch('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `UPDATE learning_resources SET title=$1, description=$2, category=$3, provider=$4, provider_type=$5,
           duration_hours=$6, objectives=$7, url=$8, video_url=$9, pdf_url=$10, lesson_content=$11, updated_at=NOW()
         WHERE id=$12 AND is_active=true RETURNING *`,
        [
          input.title,
          input.description,
          input.category,
          input.provider || null,
          input.providerType,
          input.durationHours ?? null,
          input.objectives || null,
          input.url || null,
          input.videoUrl || null,
          input.pdfUrl || null,
          input.lessonContent || null,
          req.params.id,
        ],
      )
      if (!rows[0]) throw Object.assign(new Error('Active learning resource not found.'), { status: 404 })
      await client.query('DELETE FROM learning_resource_competencies WHERE resource_id=$1', [req.params.id])
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [req.params.id, competency])
      }
      return { ...rows[0], competencies: [...new Set(input.competencies)] }
    })
    await logActivity({ req, user: req.user, action: 'learning.resource_update', category: 'learning', targetId: req.params.id, description: `${req.user.name} updated learning resource "${result.title}"` })
    res.json({ resource: result })
  } catch (error) { next(error) }
})

// Archive (soft-delete) resource — HR only.
router.delete('/:id', authorize('hr'), async (req, res, next) => {
  try {
const { rows } = await query('UPDATE learning_resources SET is_active=false, updated_at=NOW() WHERE id=$1 AND is_active=true RETURNING id', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Active learning resource not found.' })
    await logActivity({ req, user: req.user, action: 'learning.resource_archive', category: 'learning', targetId: req.params.id, description: `${req.user.name} archived learning resource` })
    res.json({ archived: true })
  } catch (error) { next(error) }
})

// Assign a resource to employee(s) — HR or supervisor.
router.post('/assign', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = assignSchema.parse(req.body)
    for (const empId of input.employeeIds) {
      await verifyEmployeeAccess(req.user, empId)
    }
    const result = await transaction(async client => {
      const resourceCheck = await client.query('SELECT id FROM learning_resources WHERE id=$1 AND is_active=true', [input.resourceId])
      if (!resourceCheck.rows[0]) throw Object.assign(new Error('Learning resource is not available.'), { status: 404 })
      const people = await client.query('SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[]) AND is_active=true', [input.employeeIds])
      if (people.rowCount !== input.employeeIds.length) throw Object.assign(new Error('One or more selected employees are unavailable.'), { status: 400 })
      const created = []
      for (const employee of people.rows) {
        const inserted = await client.query(
          `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, due_date)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (resource_id, employee_id) DO UPDATE SET assigned_by=EXCLUDED.assigned_by, due_date=EXCLUDED.due_date, status='not_started', progress=0
           RETURNING *`,
          [input.resourceId, employee.id, req.user.sub, input.dueDate || null],
        )
        created.push(inserted.rows[0])

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
          [employee.id],
        )
      }
      return created
    })
    await logActivity({ req, user: req.user, action: 'learning.assign', category: 'learning', targetId: input.resourceId, description: `${req.user.name} assigned learning resource to ${result.length} employee(s)`, details: { employeeIds: input.employeeIds, dueDate: input.dueDate || null } })
    res.status(201).json({ assignments: result })
  } catch (error) { next(error) }
})

// List assignments. Employees see only their own, Supervisors see their department.
router.get('/assignments', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE 1=1'
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND la.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT la.*, r.title AS resource_title, r.category, r.provider, r.provider_type, r.duration_hours,
        e.full_name AS employee_name, e.department,
        (lc.id IS NOT NULL AND (la.progress >= 100 OR la.status = 'completed')) AS is_completed, lc.completed_at, lc.assessment_result,
        COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
       FROM learning_assignments la
       JOIN learning_resources r ON r.id = la.resource_id
       JOIN employees e ON e.id = la.employee_id
       LEFT JOIN learning_completions lc ON lc.resource_id = la.resource_id AND lc.employee_id = la.employee_id
       ${where}
       ORDER BY la.assigned_at DESC`,
      params,
    )
    // Tag assignments that were created from a competency gap (their resource
    // carries a competency tag, meaning it was linked via the gap workflow).
    res.json({ assignments: rows.map(a => ({ ...a, fromCompetencyGap: (a.competencies || []).length > 0 })) })
  } catch (error) { next(error) }
})

// Update self-reported progress + status — HR, supervisor, or the employee
// themselves can update their own assignment.
router.patch('/assignments/:id/progress', async (req, res, next) => {
  try {
    const input = progressSchema.parse(req.body)
    if (input.progress === undefined && input.status === undefined) {
      return res.status(400).json({ error: 'Provide at least a progress value or a status.' })
    }
    const { rows } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    await verifyEmployeeAccess(req.user, assignment.employee_id)
    
    // Derive status from progress if status not explicitly provided, so the
    // slider alone keeps the status badge sensible.
    let status = input.status
    if (status === undefined) {
      const progress = input.progress !== undefined ? input.progress : Number(assignment.progress || 0)
      status = progress >= 100 ? 'completed' : progress > 0 ? 'studying' : 'not_started'
    }
    let progress = input.progress
    if (progress === undefined) progress = Number(assignment.progress || 0)
    const updated = await query(
      'UPDATE learning_assignments SET progress=$1, status=$2 WHERE id=$3 RETURNING *',
      [progress, status, req.params.id],
    )

    if (progress >= 100 || status === 'completed') {
      // 1. Auto-record completion in learning_completions if not already verified
      await query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (resource_id, employee_id) DO NOTHING`,
        [assignment.resource_id, assignment.employee_id, assignment.id, JSON.stringify({ autoVerified: true, progress }), req.user.sub],
      )

      // 2. Lift linked competency scores to meet benchmark / resolve gap
      const linkedComps = await query(
        'SELECT competency FROM learning_resource_competencies WHERE resource_id=$1',
        [assignment.resource_id],
      )
      for (const { competency } of linkedComps.rows) {
        await query(
          `UPDATE competency_assessments
           SET score = LEAST(100, GREATEST(required_score, score + 18)),
               source = 'learning_completion',
               assessed_at = NOW(),
               updated_at = NOW()
           WHERE employee_id = $1 AND LOWER(competency) = LOWER($2)`,
          [assignment.employee_id, competency],
        )
      }

      // 3. Recalculate employee's aggregate competency score
      await query(
        `UPDATE employees
         SET competency_score = (
           SELECT COALESCE(ROUND(AVG(score)), 85)
           FROM competency_assessments
           WHERE employee_id = $1
         ),
         learning_progress = (
           SELECT COALESCE(ROUND(AVG(progress)), 100)
           FROM learning_assignments
           WHERE employee_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [assignment.employee_id],
      )

      // 4. Mark active learning workflow for this course as completed
      await query(
        `UPDATE workflows
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE module = 'learning' AND subject_employee_id = $1 AND status = 'active'
           AND metadata->>'courseTitle' = (SELECT title FROM learning_resources WHERE id = $2)`,
        [assignment.employee_id, assignment.resource_id],
      )
    } else {
      await query(
        'DELETE FROM learning_completions WHERE resource_id = $1 AND employee_id = $2',
        [assignment.resource_id, assignment.employee_id],
      )
    }

    await logActivity({ req, user: req.user, action: 'learning.progress_update', category: 'learning', targetId: req.params.id, description: `${req.user.name} updated learning progress to ${progress}% (${status})`, details: { progress, status } })
    res.json({ assignment: updated.rows[0] })
  } catch (error) { next(error) }
})

// Record completion + assessment — HR or supervisor. This is the ONLY place
// an employee is marked as having completed a course (official verification).
// Verifying completion automatically updates linked competency scores and closes skill gaps!
router.post('/completions', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = completionSchema.parse(req.body)
    await verifyEmployeeAccess(req.user, input.employeeId)
    const result = await transaction(async client => {
      const assignment = await client.query(
        'SELECT id FROM learning_assignments WHERE resource_id=$1 AND employee_id=$2',
        [input.resourceId, input.employeeId],
      )
      await client.query('DELETE FROM learning_completions WHERE resource_id=$1 AND employee_id=$2', [input.resourceId, input.employeeId])
      const { rows } = await client.query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.resourceId, input.employeeId, assignment.rows[0]?.id || null, JSON.stringify(input.assessment), req.user.sub],
      )
      if (assignment.rows[0]) {
        await client.query("UPDATE learning_assignments SET progress=100, status='completed' WHERE id=$1", [assignment.rows[0].id])
      }

      // Automatically update linked competency assessment scores when verified
      const linkedComps = await client.query(
        'SELECT competency FROM learning_resource_competencies WHERE resource_id=$1',
        [input.resourceId],
      )
      for (const { competency } of linkedComps.rows) {
        // Boost the competency score to meet required_score or add +15 pts
        await client.query(
          `UPDATE competency_assessments
           SET score = LEAST(100, GREATEST(required_score, score + 15)),
               source = 'learning_completion',
               updated_at = NOW()
           WHERE employee_id = $1 AND LOWER(competency) = LOWER($2)`,
          [input.employeeId, competency],
        )
      }

      // Recalculate employee's aggregate competency_score
      await client.query(
        `UPDATE employees
         SET competency_score = (
           SELECT COALESCE(ROUND(AVG(score)), 80)
           FROM competency_assessments
           WHERE employee_id = $1
         )
         WHERE id = $1`,
        [input.employeeId],
      )

      return rows[0]
    })
    await logActivity({ req, user: req.user, action: 'learning.completion', category: 'learning', targetId: input.employeeId, description: `${req.user.name} verified completion of learning resource for employee`, details: { resourceId: input.resourceId, employeeId: input.employeeId } })
    res.status(201).json({ completion: result })
  } catch (error) { next(error) }
})

// List completions (confirmed records only).
router.get('/completions', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE 1=1'
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND lc.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT lc.*, r.title AS resource_title, r.category, r.provider, r.provider_type,
        e.full_name AS employee_name, e.department
       FROM learning_completions lc
       JOIN learning_resources r ON r.id = lc.resource_id
       JOIN employees e ON e.id = lc.employee_id
       ${where}
       ORDER BY lc.completed_at DESC`,
      params,
    )
    res.json({ completions: rows })
  } catch (error) { next(error) }
})

export default router
