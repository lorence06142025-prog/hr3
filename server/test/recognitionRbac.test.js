import nodeTest, { before } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { config } from '../src/config.js'
import { query } from '../src/db.js'
import recognitionRoutes from '../src/routes/recognition.js'

let dbAvailable = false
let hrUser = null
let employeeUser = null
let eligibleEmployeeUser = null
let ineligibleEmployeeUser = null
let eligibleNominee = null
let ineligibleNominee = null

const rawTest = nodeTest
const test = (name, ...args) => {
  const fn = args[args.length - 1]
  const rest = args.slice(0, -1)
  return rawTest(name, ...rest, async (...fnArgs) => {
    if (!dbAvailable) return
    return fn(...fnArgs)
  })
}

before(async () => {
  try {
    const hrRes = await query("SELECT u.id, u.email, u.role, u.employee_id, u.full_name FROM users u WHERE u.role = 'hr' AND u.is_active = true LIMIT 1")
    const empRes = await query("SELECT u.id, u.email, u.role, u.employee_id, u.full_name FROM users u WHERE u.role = 'employee' AND u.is_active = true LIMIT 1")

    // Users with / without completed performance evaluations
    const eligibleEmpRes = await query(`
      SELECT u.id, u.email, u.role, u.employee_id, u.full_name
      FROM users u
      JOIN workflows w ON w.subject_employee_id = u.employee_id AND w.module = 'performance' AND w.status = 'completed'
      WHERE u.role = 'employee' AND u.is_active = true
      LIMIT 1
    `)
    const ineligibleEmpRes = await query(`
      SELECT u.id, u.email, u.role, u.employee_id, u.full_name
      FROM users u
      WHERE u.role = 'employee' AND u.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM workflows w
          WHERE w.subject_employee_id = u.employee_id AND w.module = 'performance' AND w.status = 'completed'
        )
      LIMIT 1
    `)

    // Nominees with / without completed performance evaluations
    const eligibleNomRes = await query(`
      SELECT e.id, e.full_name, e.department, e.job_title
      FROM employees e
      JOIN workflows w ON w.subject_employee_id = e.id AND w.module = 'performance' AND w.status = 'completed'
      WHERE e.is_active = true
      LIMIT 1
    `)
    const ineligibleNomRes = await query(`
      SELECT e.id, e.full_name, e.department, e.job_title
      FROM employees e
      WHERE e.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM workflows w
          WHERE w.subject_employee_id = e.id AND w.module = 'performance' AND w.status = 'completed'
        )
      LIMIT 1
    `)

    if (hrRes.rows?.[0] && empRes.rows?.[0]) {
      dbAvailable = true
      hrUser = {
        sub: hrRes.rows[0].id,
        id: hrRes.rows[0].id,
        role: 'hr',
        name: hrRes.rows[0].full_name,
        email: hrRes.rows[0].email,
        employeeId: hrRes.rows[0].employee_id,
      }
      employeeUser = {
        sub: empRes.rows[0].id,
        id: empRes.rows[0].id,
        role: 'employee',
        name: empRes.rows[0].full_name,
        email: empRes.rows[0].email,
        employeeId: empRes.rows[0].employee_id,
      }
      if (eligibleEmpRes.rows?.[0]) {
        eligibleEmployeeUser = {
          sub: eligibleEmpRes.rows[0].id,
          id: eligibleEmpRes.rows[0].id,
          role: 'employee',
          name: eligibleEmpRes.rows[0].full_name,
          email: eligibleEmpRes.rows[0].email,
          employeeId: eligibleEmpRes.rows[0].employee_id,
        }
      }
      if (ineligibleEmpRes.rows?.[0]) {
        ineligibleEmployeeUser = {
          sub: ineligibleEmpRes.rows[0].id,
          id: ineligibleEmpRes.rows[0].id,
          role: 'employee',
          name: ineligibleEmpRes.rows[0].full_name,
          email: ineligibleEmpRes.rows[0].email,
          employeeId: ineligibleEmpRes.rows[0].employee_id,
        }
      }
      eligibleNominee = eligibleNomRes.rows?.[0] || null
      ineligibleNominee = ineligibleNomRes.rows?.[0] || null
    }
  } catch (err) {
    console.warn('[recognitionRbac.test.js] Database not available, skipping live tests:', err.message)
  }
})

// Helper to simulate request to an express route handler
function executeRoute(router, method, path, user, body = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: path,
      originalUrl: path,
      path,
      user,
      body,
      query: {},
      params: {},
      headers: {
        authorization: `Bearer ${jwt.sign(user, config.jwtSecret, { expiresIn: '15m' })}`,
      },
    }

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      json(data) {
        resolve({ statusCode: this.statusCode, data })
      },
    }

    const next = (err) => {
      if (err) reject(err)
      else resolve({ statusCode: res.statusCode, data: null })
    }

    router.handle(req, res, next)
  })
}

test('HR/Admin retrieves performance, competency, and learning scores in /colleagues', async () => {
  const res = await executeRoute(recognitionRoutes, 'GET', '/colleagues', hrUser)
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.data.employees))
  assert.ok(res.data.employees.length > 0)

  const first = res.data.employees[0]
  assert.ok('full_name' in first)
  assert.ok('job_title' in first)
  assert.ok('department' in first)
  assert.ok('performance_score' in first, 'HR should see performance_score')
  assert.ok('competency_score' in first, 'HR should see competency_score')
  assert.ok('learning_progress' in first, 'HR should see learning_progress')
  assert.equal(typeof first.performance_score, 'number')
  assert.equal(typeof first.competency_score, 'number')
  assert.equal(typeof first.learning_progress, 'number')
})

test('Regular employee receives NO performance, competency, or learning scores in /colleagues', async () => {
  const res = await executeRoute(recognitionRoutes, 'GET', '/colleagues', employeeUser)
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.data.employees))
  assert.ok(res.data.employees.length > 0)

  for (const emp of res.data.employees) {
    assert.ok('full_name' in emp)
    assert.ok('job_title' in emp)
    assert.ok('department' in emp)
    assert.equal('performance_score' in emp, false, 'Regular employee must NOT see performance_score')
    assert.equal('competency_score' in emp, false, 'Regular employee must NOT see competency_score')
    assert.equal('learning_progress' in emp, false, 'Regular employee must NOT see learning_progress')
  }
})

test('HR receives recipientMetrics in /pending for validation and review', async () => {
  const res = await executeRoute(recognitionRoutes, 'GET', '/pending', hrUser)
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.data.pending))

  // If there are pending nominations, HR should see recipientMetrics on each
  if (res.data.pending.length > 0) {
    const first = res.data.pending[0]
    assert.ok('recipientMetrics' in first, 'HR pending response must contain recipientMetrics')
    assert.ok('performance' in first.recipientMetrics)
    assert.ok('competency' in first.recipientMetrics)
    assert.ok('learning' in first.recipientMetrics)
  }
})

test('Regular employee never receives recipientMetrics in /pending', async () => {
  const res = await executeRoute(recognitionRoutes, 'GET', '/pending', employeeUser)
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.data.pending))

  for (const item of res.data.pending) {
    assert.equal('recipientMetrics' in item, false, 'Employee must NOT see recipientMetrics in pending queue')
  }
})

test('Colleagues endpoint returns has_completed_performance_eval and userEligibility', async () => {
  const res = await executeRoute(recognitionRoutes, 'GET', '/colleagues', employeeUser)
  assert.equal(res.statusCode, 200)
  assert.ok('userEligibility' in res.data, 'Response should contain userEligibility')
  assert.equal(typeof res.data.userEligibility.canNominate, 'boolean')
  assert.equal(typeof res.data.userEligibility.hasCompletedPerformanceEvaluation, 'boolean')

  const first = res.data.employees[0]
  assert.ok('has_completed_performance_eval' in first)
  assert.equal(typeof first.has_completed_performance_eval, 'boolean')
})

test('Employee without completed performance evaluation cannot submit nomination (403)', async () => {
  if (!ineligibleEmployeeUser || !eligibleNominee) return

  const res = await executeRoute(recognitionRoutes, 'POST', '/post', ineligibleEmployeeUser, {
    recipientId: eligibleNominee.id,
    recipientName: eligibleNominee.full_name,
    recipientDepartment: eligibleNominee.department,
    recipientJobTitle: eligibleNominee.job_title,
    badge: 'Guest Delight Champion',
    coreValue: 'Guest Delight',
    tag: '#GuestDelight',
    message: 'Test recognition nomination from unevaluated employee.',
  })

  assert.equal(res.statusCode, 403)
  assert.equal(res.data?.code, 'NOMINATOR_EVALUATION_REQUIRED')
  assert.match(res.data?.error || '', /Performance Evaluation prerequisite required/i)
})

test('Employee with completed performance evaluation can submit nomination for evaluated colleague (201)', async () => {
  if (!eligibleEmployeeUser || !eligibleNominee) return

  const res = await executeRoute(recognitionRoutes, 'POST', '/post', eligibleEmployeeUser, {
    recipientId: eligibleNominee.id,
    recipientName: eligibleNominee.full_name,
    recipientDepartment: eligibleNominee.department,
    recipientJobTitle: eligibleNominee.job_title,
    badge: 'Guest Delight Champion',
    coreValue: 'Guest Delight',
    tag: '#GuestDelight',
    message: 'Test recognition nomination from evaluated employee for evaluated peer.',
  })

  assert.equal(res.statusCode, 201)
  assert.ok(res.data?.post)
  assert.equal(res.data?.status, 'awaiting_supervisor')
})

test('Nomination is rejected if recipient employee has not completed performance evaluation (400)', async () => {
  if (!eligibleEmployeeUser || !ineligibleNominee) return

  const res = await executeRoute(recognitionRoutes, 'POST', '/post', eligibleEmployeeUser, {
    recipientId: ineligibleNominee.id,
    recipientName: ineligibleNominee.full_name,
    recipientDepartment: ineligibleNominee.department,
    recipientJobTitle: ineligibleNominee.job_title,
    badge: 'Guest Delight Champion',
    coreValue: 'Guest Delight',
    tag: '#GuestDelight',
    message: 'Test recognition for unevaluated recipient.',
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.data?.code, 'RECIPIENT_EVALUATION_REQUIRED')
  assert.match(res.data?.error || '', /has not completed a performance evaluation/i)
})

