import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { getScopeFilter, verifyEmployeeAccess } from '../services/departmentScope.js'

const router = Router()
router.use(authenticate)

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  fullName: z.string().min(1).max(120),
  departmentId: z.string().uuid(),
  jobTitle: z.string().min(1).max(120),
  managerId: z.string().uuid().nullable().optional(),
  performanceScore: z.number().min(0).max(100).optional().default(0),
  competencyScore: z.number().min(0).max(100).optional().default(0),
  learningProgress: z.number().min(0).max(100).optional().default(0),
  // Optional Account Creation fields
  email: z.string().email().nullable().optional(),
  password: z.string().min(6).max(128).nullable().optional(),
  role: z.enum(['employee', 'supervisor', 'management', 'hr', 'operations_manager']).optional().default('employee'),
})

const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  departmentId: z.string().uuid().optional(),
  jobTitle: z.string().min(1).max(120).optional(),
  managerId: z.string().uuid().nullable().optional(),
  performanceScore: z.number().min(0).max(100).optional(),
  competencyScore: z.number().min(0).max(100).optional(),
  learningProgress: z.number().min(0).max(100).optional(),
})

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['employee', 'supervisor', 'management', 'hr', 'operations_manager']).default('employee'),
  fullName: z.string().min(1).max(120),
  departmentId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
})

// !!! Static routes must be defined BEFORE parameterized /:id routes !!!

// GET /api/employees/departments — list departments
router.get('/departments', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, created_at FROM departments ORDER BY name')
    res.json({ departments: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/org-tree — get visual hierarchy with succession & competency metadata
router.get('/org-tree', async (_req, res, next) => {
  try {
    const empRes = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
             e.manager_id, m.full_name AS manager_name,
             e.performance_score, e.competency_score, e.learning_progress, e.is_active,
             e.avatar_url,
             sp.readiness_score, sp.readiness_band, sp.target_role,
             d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN succession_profiles sp ON sp.employee_id = e.id
      WHERE e.is_active = true
      ORDER BY e.department, e.full_name
    `)
    const employees = empRes.rows

    // Build node map
    const nodeMap = new Map()
    const deptStats = {}

    employees.forEach((emp) => {
      const perf = Number(emp.performance_score) || 0
      const comp = Number(emp.competency_score) || 0
      const learn = Number(emp.learning_progress) || 0

      // Determine succession readiness if not explicitly in table
      let readinessBand = emp.readiness_band
      // Official formula: 50% Performance + 30% Competency + 20% Learning (matches successionService.js)
      let readinessScore = Number(emp.readiness_score) || Math.round((perf * 0.5) + (comp * 0.3) + (learn * 0.2))
      if (!readinessBand) {
        if (readinessScore >= 85) {
          readinessBand = 'ready_now'
        } else if (readinessScore >= 70) {
          readinessBand = 'ready_in_1_2_years'
        } else {
          readinessBand = 'development_needed'
        }
      }

      // Determine flight risk
      let flightRisk = 'low'
      if (perf >= 85 && learn < 60) flightRisk = 'medium'
      if (perf < 75 && learn < 50) flightRisk = 'high'

      // Department aggregations
      const deptName = emp.department || 'General'
      if (!deptStats[deptName]) {
        deptStats[deptName] = { name: deptName, count: 0, totalPerf: 0, totalComp: 0 }
      }
      deptStats[deptName].count += 1
      deptStats[deptName].totalPerf += perf
      deptStats[deptName].totalComp += comp

      // Sample department-tailored competency indicators
      const competencies = [
        { name: 'Core Hospitality & Service', score: comp },
        { name: 'Standard Operating Procedures', score: Math.min(100, Math.round(comp * 0.95 + 4)) },
        { name: 'Guest Experience & Conflict Care', score: Math.min(100, Math.round(perf * 0.98 + 2)) },
        { name: 'Safety, Hygiene & Food Sanitation', score: Math.min(100, Math.round(learn * 0.9 + 10)) },
        { name: 'Leadership & Succession Potential', score: Math.min(100, Math.round(readinessScore)) },
      ]

      nodeMap.set(emp.id, {
        id: emp.id,
        employeeNumber: emp.employee_number,
        fullName: emp.full_name,
        avatarUrl: emp.avatar_url || null,
        department: emp.department,
        jobTitle: emp.job_title,
        managerId: emp.manager_id,
        managerName: emp.manager_name,
        performanceScore: perf,
        competencyScore: comp,
        learningProgress: learn,
        readinessBand,
        readinessScore,
        targetRole: emp.target_role || (emp.manager_name ? `${emp.manager_name}'s Role` : 'Executive Leadership'),
        flightRisk,
        competencies,
        children: [],
        directReportsCount: 0,
      })
    })

    // Populate children and potential successors
    const roots = []
    nodeMap.forEach((node) => {
      if (node.managerId && nodeMap.has(node.managerId)) {
        const manager = nodeMap.get(node.managerId)
        manager.children.push(node)
        manager.directReportsCount += 1
      } else {
        roots.push(node)
      }
    })

    // If there's an Executive Office root (e.g. Noah Santos), make sure top level is organized
    const sortedRoots = roots.sort((a, b) => {
      if (a.department === 'Executive Office') return -1
      if (b.department === 'Executive Office') return 1
      return a.fullName.localeCompare(b.fullName)
    })

    const departmentsSummary = Object.values(deptStats).map(d => ({
      name: d.name,
      headcount: d.count,
      avgPerformance: Math.round(d.totalPerf / d.count),
      avgCompetency: Math.round(d.totalComp / d.count),
    }))

    const summary = {
      totalEmployees: employees.length,
      totalDepartments: Object.keys(deptStats).length,
      readyNowCount: Array.from(nodeMap.values()).filter(n => n.readinessBand === 'ready_now').length,
      ready1to2YearsCount: Array.from(nodeMap.values()).filter(n => n.readinessBand === 'ready_in_1_2_years').length,
      developmentNeededCount: Array.from(nodeMap.values()).filter(n => n.readinessBand === 'development_needed').length,
      highFlightRiskCount: Array.from(nodeMap.values()).filter(n => n.flightRisk === 'high').length,
    }

    res.json({
      tree: sortedRoots,
      nodes: Array.from(nodeMap.values()),
      departments: departmentsSummary,
      summary,
    })
  } catch (error) { next(error) }
})

// ---------------------------------------------------------------------------
// Self-Service Profile Endpoints (Accessible to all authenticated users)
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  emergencyContactName: z.string().max(120).nullable().optional(),
  emergencyContactPhone: z.string().max(50).nullable().optional(),
  emergencyContactRelationship: z.string().max(80).nullable().optional(),
  avatarUrl: z.string().max(500000).nullable().optional(),
})

// GET /api/employees/profile/me — authenticated user's profile and employee record
router.get('/profile/me', async (req, res, next) => {
  try {
    const userRes = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.employee_id, u.avatar_url AS user_avatar, u.two_factor_enabled
       FROM users u WHERE u.id = $1`,
      [req.user.sub],
    )
    const user = userRes.rows[0]
    if (!user) return res.status(404).json({ error: 'User account not found.' })

    let employee = null
    if (user.employee_id) {
      const empRes = await query(
        `SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
                e.phone, e.address, e.emergency_contact_name, e.emergency_contact_phone,
                e.emergency_contact_relationship, e.avatar_url,
                e.performance_score, e.competency_score, e.learning_progress
         FROM employees e WHERE e.id = $1`,
        [user.employee_id],
      )
      employee = empRes.rows[0] || null
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.user_avatar || employee?.avatar_url || null,
        twoFactorEnabled: Boolean(user.two_factor_enabled),
      },
      employee: employee ? {
        id: employee.id,
        employeeNumber: employee.employee_number,
        fullName: employee.full_name,
        department: employee.department,
        jobTitle: employee.job_title,
        phone: employee.phone || '',
        address: employee.address || '',
        emergencyContactName: employee.emergency_contact_name || '',
        emergencyContactPhone: employee.emergency_contact_phone || '',
        emergencyContactRelationship: employee.emergency_contact_relationship || '',
        avatarUrl: employee.avatar_url || user.user_avatar || null,
        performanceScore: employee.performance_score,
        competencyScore: employee.competency_score,
        learningProgress: employee.learning_progress,
      } : null,
    })
  } catch (error) { next(error) }
})

// PATCH /api/employees/profile/me — self-service update for personal contact & emergency details
router.patch('/profile/me', async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body)
    const userRes = await query('SELECT id, employee_id, full_name FROM users WHERE id = $1', [req.user.sub])
    const user = userRes.rows[0]
    if (!user) return res.status(404).json({ error: 'User account not found.' })

    if (input.avatarUrl !== undefined) {
      await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [input.avatarUrl, user.id])
    }

    let updatedEmployee = null
    if (user.employee_id) {
      const resEmp = await query(
        `UPDATE employees
         SET phone = COALESCE($1, phone),
             address = COALESCE($2, address),
             emergency_contact_name = COALESCE($3, emergency_contact_name),
             emergency_contact_phone = COALESCE($4, emergency_contact_phone),
             emergency_contact_relationship = COALESCE($5, emergency_contact_relationship),
             avatar_url = COALESCE($6, avatar_url),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          input.phone !== undefined ? input.phone : null,
          input.address !== undefined ? input.address : null,
          input.emergencyContactName !== undefined ? input.emergencyContactName : null,
          input.emergencyContactPhone !== undefined ? input.emergencyContactPhone : null,
          input.emergencyContactRelationship !== undefined ? input.emergencyContactRelationship : null,
          input.avatarUrl !== undefined ? input.avatarUrl : null,
          user.employee_id,
        ],
      )
      updatedEmployee = resEmp.rows[0]
    }

    await logActivity({
      req,
      user: req.user,
      action: 'employee.profile_self_update',
      category: 'employee',
      targetId: user.employee_id || user.id,
      description: `${req.user.name} updated their personal contact profile`,
    })

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      employee: updatedEmployee,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : (updatedEmployee?.avatar_url || null),
    })
  } catch (error) { next(error) }
})

// POST /api/employees/invite — send invite (HR only)
router.post('/invite', authorize('hr'), async (req, res, next) => {
  try {
    const input = inviteSchema.parse(req.body)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    const { rows } = await query(`
      INSERT INTO invitations (email, role, full_name, department_id, employee_id, token, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, role, full_name, expires_at
    `, [input.email, input.role, input.fullName, input.departmentId || null, input.employeeId || null, token, expiresAt, req.user.sub])
    await logActivity({ req, user: req.user, action: 'employee.invite', category: 'auth', description: `${req.user.name} invited ${input.fullName} (${input.role})`, details: { email: input.email, role: input.role } })
    res.status(201).json({
      invitation: rows[0],
      registerUrl: `${req.protocol}://${req.get('host')}/register?token=${token}`,
    })
  } catch (error) { next(error) }
})

// GET /api/employees — list active employees (scoped to department for supervisors)
router.get('/', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE e.is_active = true'
    if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
             e.manager_id, m.full_name AS manager_name,
             e.performance_score, e.competency_score, e.learning_progress, e.is_active,
             e.avatar_url,
             e.created_at, e.updated_at,
             d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      ${where}
      ORDER BY e.full_name
    `, params)
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/all — list all employees including inactive (HR only)
router.get('/all', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
             e.manager_id, m.full_name AS manager_name,
             e.performance_score, e.competency_score, e.learning_progress, e.is_active,
             e.avatar_url,
             e.created_at, e.updated_at,
             d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER BY e.is_active DESC, e.full_name
    `)
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/reportees/:id — employees who report to given manager
router.get('/reportees/:id', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    await verifyEmployeeAccess(req.user, req.params.id)
    const { rows } = await query('SELECT id, full_name, job_title FROM employees WHERE manager_id = $1 AND is_active = true ORDER BY full_name', [req.params.id])
    res.json({ reportees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/:id — single employee
router.get('/:id', authorize('hr', 'operations_manager', 'supervisor', 'employee'), async (req, res, next) => {
  try {
    await verifyEmployeeAccess(req.user, req.params.id)
    const { rows } = await query(`
      SELECT e.*, m.full_name AS manager_name, d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1
    `, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
    res.json({ employee: rows[0] })
  } catch (error) { next(error) }
})


// POST /api/employees — create employee (HR only) + optional immediate user account
router.post('/', authorize('hr'), async (req, res, next) => {
  try {
    const input = createEmployeeSchema.parse(req.body)
    const result = await transaction(async (client) => {
      // 1. If email is provided, check if email is already taken
      if (input.email) {
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [input.email.toLowerCase().trim()])
        if (existing.rowCount > 0) {
          throw Object.assign(new Error(`A user account with email "${input.email}" already exists.`), { status: 409 })
        }
      }

      // 2. Insert employee record
      const { rows } = await client.query(`
        INSERT INTO employees (employee_number, full_name, department_id, department, job_title, manager_id, performance_score, competency_score, learning_progress)
        VALUES ($1, $2, $3, (SELECT name FROM departments WHERE id = $3), $4, $5, $6, $7, $8)
        RETURNING *
      `, [input.employeeNumber, input.fullName, input.departmentId, input.jobTitle, input.managerId || null, input.performanceScore, input.competencyScore, input.learningProgress])
      
      const employee = rows[0]

      // 3. Insert score history record
      await client.query('INSERT INTO score_history (employee_id, performance_score, competency_score, learning_progress) VALUES ($1, $2, $3, $4)', [employee.id, employee.performance_score, employee.competency_score, employee.learning_progress])

      // 4. Create user login account if email & password are provided
      let userAccount = null
      if (input.email && input.password) {
        const passwordHash = await bcrypt.hash(input.password, 12)
        const userRes = await client.query(`
          INSERT INTO users (email, password_hash, full_name, role, employee_id, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING id, email, role, full_name, employee_id
        `, [input.email.toLowerCase().trim(), passwordHash, input.fullName, input.role || 'employee', employee.id])
        userAccount = userRes.rows[0]
      }

      return { employee, userAccount }
    })

    await logActivity({
      req,
      user: req.user,
      action: 'employee.create',
      category: 'employee',
      targetId: result.employee.id,
      description: `${req.user.name} created employee ${input.fullName}${result.userAccount ? ` with login role (${result.userAccount.role})` : ''}`,
      details: { employeeNumber: input.employeeNumber, departmentId: input.departmentId, role: input.role || 'employee', userCreated: Boolean(result.userAccount) }
    })

    res.status(201).json({ employee: result.employee, user: result.userAccount })
  } catch (error) { next(error) }
})

// PATCH /api/employees/:id — update employee (HR only)
router.patch('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const input = updateEmployeeSchema.parse(req.body)
    const sets = []; const params = []; let idx = 1
    if (input.fullName !== undefined) { sets.push(`full_name = $${idx++}`); params.push(input.fullName) }
    if (input.departmentId !== undefined) { sets.push(`department_id = $${idx++}, department = (SELECT name FROM departments WHERE id = $${idx - 1})`); params.push(input.departmentId) }
    if (input.jobTitle !== undefined) { sets.push(`job_title = $${idx++}`); params.push(input.jobTitle) }
    if (input.managerId !== undefined) { sets.push(`manager_id = $${idx++}`); params.push(input.managerId) }
    if (input.performanceScore !== undefined) { sets.push(`performance_score = $${idx++}`); params.push(input.performanceScore) }
    if (input.competencyScore !== undefined) { sets.push(`competency_score = $${idx++}`); params.push(input.competencyScore) }
    if (input.learningProgress !== undefined) { sets.push(`learning_progress = $${idx++}`); params.push(input.learningProgress) }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' })
    params.push(req.params.id)
const { rows } = await query(`UPDATE employees SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params)
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
    await logActivity({ req, user: req.user, action: 'employee.update', category: 'employee', targetId: req.params.id, description: `${req.user.name} updated employee ${rows[0].full_name}`, details: { changedFields: Object.keys(input) } })
    res.json({ employee: rows[0] })
  } catch (error) { next(error) }
})

// POST /api/employees/:id/deactivate (HR only)
router.post('/:id/deactivate', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING *", [req.params.id])
if (!rows[0]) return res.status(404).json({ error: 'Active employee not found.' })
    await query('UPDATE users SET is_active = false WHERE employee_id = $1', [req.params.id])
    await logActivity({ req, user: req.user, action: 'employee.deactivate', category: 'employee', targetId: req.params.id, description: `${req.user.name} deactivated employee ${rows[0].full_name}` })
    res.json({ deactivated: true, employee: rows[0] })
  } catch (error) { next(error) }
})

// POST /api/employees/:id/reactivate (HR only)
router.post('/:id/reactivate', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE employees SET is_active = true, updated_at = NOW() WHERE id = $1 AND is_active = false RETURNING *", [req.params.id])
if (!rows[0]) return res.status(404).json({ error: 'Inactive employee not found.' })
    await query('UPDATE users SET is_active = true WHERE employee_id = $1', [req.params.id])
    await logActivity({ req, user: req.user, action: 'employee.reactivate', category: 'employee', targetId: req.params.id, description: `${req.user.name} reactivated employee ${rows[0].full_name}` })
    res.json({ reactivated: true, employee: rows[0] })
  } catch (error) { next(error) }
})

// GET /api/employees/:id/history — score history time-series
router.get('/:id/history', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, performance_score, competency_score, learning_progress, recorded_at
      FROM score_history
      WHERE employee_id = $1
      ORDER BY recorded_at ASC
    `, [req.params.id])
    res.json({ history: rows })
  } catch (error) { next(error) }
})

export default router
