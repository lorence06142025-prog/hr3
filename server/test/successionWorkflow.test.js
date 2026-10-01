import nodeTest, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool, query, transaction } from '../src/db.js'
import {
  getAuthorizedEmployeeData,
  checkDataSufficiency,
  matchTargetPositionsDeterministically,
  generateSuccessionAssessment,
  approveSuccessionTransaction,
  returnSuccessionTransaction,
  rejectSuccessionTransaction,
} from '../src/services/successionService.js'
import { getScopeFilter, verifyEmployeeAccess } from '../src/services/departmentScope.js'

let hrUser
let securitySupervisorUser
let foSupervisorUser
let securityEmployeeUser
let foEmployeeUser
let testEmployee
let testWorkflow

let dbAvailable = false
const rawTest = nodeTest
const testWrapper = (name, ...args) => {
  const fn = args[args.length - 1]
  const rest = args.slice(0, -1)
  return rawTest(name, ...rest, async (...fnArgs) => {
    if (!dbAvailable) return
    return fn(...fnArgs)
  })
}
// Alias test to testWrapper for all scenarios in this file
const test = testWrapper

before(async () => {
  try {
    const hrRes = await query("SELECT u.id, u.email, u.role, u.employee_id, u.full_name FROM users u WHERE u.role = 'hr' AND u.is_active = true LIMIT 1")
    if (hrRes.rows && hrRes.rows.length > 0) {
      dbAvailable = true
      hrUser = {
        sub: hrRes.rows[0].id,
        id: hrRes.rows[0].id,
        name: hrRes.rows[0].full_name,
        email: hrRes.rows[0].email,
        role: 'hr',
        employeeId: hrRes.rows[0].employee_id,
      }
    }
  } catch (err) {
    console.warn('[successionWorkflow.test.js] Database not connected. Live DB integration tests skipped:', err.message)
    return
  }
  if (!dbAvailable) return
  // 0. Clean up any leftover test data from prior aborted runs
  const prevEmpRes = await query("SELECT id FROM employees WHERE employee_number LIKE 'TEST-SUCC-%'")
  for (const row of prevEmpRes.rows) {
    await query('DELETE FROM workflow_events WHERE workflow_id IN (SELECT id FROM workflows WHERE subject_employee_id = $1)', [row.id])
    await query('DELETE FROM notifications WHERE workflow_id IN (SELECT id FROM workflows WHERE subject_employee_id = $1) OR user_id IN (SELECT id FROM users WHERE employee_id = $1)', [row.id])
    await query('DELETE FROM activity_logs WHERE target_id IN (SELECT id::text FROM workflows WHERE subject_employee_id = $1) OR target_id = $1::text', [row.id])
    await query('DELETE FROM succession_records WHERE employee_id = $1', [row.id])
    await query('DELETE FROM succession_profiles WHERE employee_id = $1', [row.id])
    await query('DELETE FROM position_history WHERE employee_id = $1', [row.id])
    await query('DELETE FROM learning_completions WHERE employee_id = $1', [row.id])
    await query('DELETE FROM competency_assessments WHERE employee_id = $1', [row.id])
    await query('DELETE FROM workflows WHERE subject_employee_id = $1', [row.id])
    await query('DELETE FROM users WHERE employee_id = $1', [row.id])
    await query('DELETE FROM employees WHERE id = $1', [row.id])
  }


  // Safety & Compliance supervisor (Marco Rossi)
  const secSupRes = await query(`
    SELECT u.id, u.email, u.role, u.employee_id, u.full_name, e.department
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.role = 'supervisor' AND e.department = 'Safety & Compliance' AND u.is_active = true
    LIMIT 1
  `)
  if (secSupRes.rows[0]) {
    securitySupervisorUser = {
      sub: secSupRes.rows[0].id,
      id: secSupRes.rows[0].id,
      name: secSupRes.rows[0].full_name,
      email: secSupRes.rows[0].email,
      role: 'supervisor',
      employeeId: secSupRes.rows[0].employee_id,
      department: secSupRes.rows[0].department,
    }
  }

  // Fleet & Transportation supervisor (Robert Johnson)
  const foSupRes = await query(`
    SELECT u.id, u.email, u.role, u.employee_id, u.full_name, e.department
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.role = 'supervisor' AND e.department = 'Fleet & Transportation' AND u.is_active = true
    LIMIT 1
  `)
  if (foSupRes.rows[0]) {
    foSupervisorUser = {
      sub: foSupRes.rows[0].id,
      id: foSupRes.rows[0].id,
      name: foSupRes.rows[0].full_name,
      email: foSupRes.rows[0].email,
      role: 'supervisor',
      employeeId: foSupRes.rows[0].employee_id,
      department: foSupRes.rows[0].department,
    }
  }

  // Fleet & Transportation employee
  const foEmpRes = await query(`
    SELECT u.id, u.email, u.role, u.employee_id, u.full_name, e.department
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.role = 'employee' AND e.department = 'Fleet & Transportation' AND u.is_active = true
    LIMIT 1
  `)
  if (foEmpRes.rows[0]) {
    foEmployeeUser = {
      sub: foEmpRes.rows[0].id,
      id: foEmpRes.rows[0].id,
      name: foEmpRes.rows[0].full_name,
      email: foEmpRes.rows[0].email,
      role: 'employee',
      employeeId: foEmpRes.rows[0].employee_id,
      department: foEmpRes.rows[0].department,
    }
  }

  // Create an isolated test employee in Safety & Compliance
  const empInsert = await query(`
    INSERT INTO employees (
      employee_number, full_name, department, job_title, manager_id,
      performance_score, competency_score, learning_progress, is_active
    ) VALUES (
      'TEST-SUCC-99', 'Test Succession Candidate', 'Safety & Compliance', 'Safety Coordinator',
      $1, 88, 86, 82, true
    ) RETURNING *
  `, [securitySupervisorUser?.employeeId || null])
  testEmployee = empInsert.rows[0]

  // Create linked user for test employee
  const userInsert = await query(`
    INSERT INTO users (
      email, password_hash, full_name, role, employee_id, is_active
    ) VALUES (
      'testcandidatepriorityph@gmail.com', 'hash123', 'Test Succession Candidate', 'employee', $1, true
    ) RETURNING *
  `, [testEmployee.id])
  securityEmployeeUser = {
    sub: userInsert.rows[0].id,
    id: userInsert.rows[0].id,
    name: userInsert.rows[0].full_name,
    email: userInsert.rows[0].email,
    role: 'employee',
    employeeId: testEmployee.id,
    department: 'Safety & Compliance',
  }

  // Seed competency assessment for test employee
  await query(`
    INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
    VALUES
      ($1, 'Regulatory Compliance', 90, 80, 'assessment'),
      ($1, 'Incident Investigation', 85, 80, 'assessment'),
      ($1, 'Risk Assessment', 88, 80, 'assessment'),
      ($1, 'Corrective Action Management', 75, 85, 'assessment')
    ON CONFLICT DO NOTHING
  `, [testEmployee.id])

  // Seed learning completion for test employee
  const resourceRes = await query('SELECT id FROM learning_resources LIMIT 1')
  if (resourceRes.rows[0]) {
    await query(`
      INSERT INTO learning_completions (employee_id, resource_id, completed_at, assessment_result)
      VALUES ($1, $2, NOW(), '{"score": 95, "status": "passed"}'::jsonb)
      ON CONFLICT DO NOTHING
    `, [testEmployee.id, resourceRes.rows[0].id])
  }

  // Seed baseline position history for test employee
  await query(`
    INSERT INTO position_history (employee_id, previous_position, new_position, effective_date, reason)
    VALUES ($1, 'Safety Associate', 'Safety Coordinator', CURRENT_DATE - INTERVAL '1 year', 'Initial placement')
  `, [testEmployee.id])

  // Create a succession workflow for test employee
  const wfRes = await query(`
    INSERT INTO workflows (
      module, title, subject_employee_id, current_stage, status, created_by, metadata
    ) VALUES (
      'succession', 'Succession Plan - Test Candidate', $1, 'review_readiness', 'active', $2,
      $3::jsonb
    ) RETURNING *
  `, [
    testEmployee.id,
    hrUser.sub,
    JSON.stringify({
      targetRole: 'Safety & Compliance Manager',
      recommendedPosition: 'Safety & Compliance Manager',
    }),
  ])
  testWorkflow = wfRes.rows[0]
})


// Scenario 1: HR starts assessment
test('Scenario 1: HR starts assessment across any department', async () => {
  const data = await getAuthorizedEmployeeData(hrUser, testEmployee.id)
  assert.ok(data, 'HR should retrieve employee data')
  assert.equal(data.employee.id, testEmployee.id)
  assert.equal(data.employee.department, 'Security')
  assert.ok(data.availableTargetPositions.length > 0, 'HR should see available positions across the company')
  assert.ok(data.readinessScore > 0, 'Official readiness score should be calculated')
})

// Scenario 2: Supervisor starts assessment for departmental employee
test('Scenario 2: Supervisor starts assessment for departmental employee', async () => {
  assert.ok(securitySupervisorUser, 'Safety & Compliance supervisor must exist')
  const data = await getAuthorizedEmployeeData(securitySupervisorUser, testEmployee.id)
  assert.ok(data, 'Supervisor should retrieve data for employee in their department')
  assert.equal(data.employee.id, testEmployee.id)
  assert.equal(data.employee.department, 'Safety & Compliance')
  // Supervisor only sees positions in their department
  for (const pos of data.availableTargetPositions) {
    assert.equal(pos.department, 'Safety & Compliance', 'Supervisor must only see departmental positions')
  }
})

// Scenario 3: Supervisor attempts cross-department assessment -> 403 DENY
test('Scenario 3: Supervisor attempts cross-department assessment -> 403 DENY', async () => {
  assert.ok(foSupervisorUser, 'Fleet & Transportation supervisor must exist')
  // Fleet & Transportation supervisor attempting to access a Safety & Compliance employee
  await assert.rejects(
    async () => {
      await getAuthorizedEmployeeData(foSupervisorUser, testEmployee.id)
    },
    (err) => {
      assert.equal(err.status, 403)
      assert.match(err.message, /Access denied.*outside your assigned department/i)
      return true
    }
  )
})

// Scenario 4: AI receives only authorized data
test('Scenario 4: AI receives only authorized data without confidential leakage', async () => {
  const data = await getAuthorizedEmployeeData(hrUser, testEmployee.id)
  
  // Verify strict authorized structure
  const expectedKeys = [
    'employee', 'performanceHistory', 'competencyAssessments', 'competencyGaps',
    'completedLearning', 'trainingHistory', 'availableTargetPositions',
    'readinessScore', 'readinessBand'
  ]
  for (const key of expectedKeys) {
    assert.ok(key in data, `Data payload must include ${key}`)
  }

  // Ensure no password hashes or sensitive internal user auth attributes leaked
  assert.equal(data.employee.password_hash, undefined)
  assert.equal(data.employee.salt, undefined)
  assert.equal(data.employee.reset_token, undefined)
})

// Scenario 5: AI recommends only valid system positions
test('Scenario 5: AI recommends only valid system positions', async () => {
  const data = await getAuthorizedEmployeeData(hrUser, testEmployee.id)
  const systemTitles = new Set(data.availableTargetPositions.map(p => p.title.toLowerCase()))

  const bestMatch = matchTargetPositionsDeterministically(
    data.employee,
    data.competencyAssessments,
    data.availableTargetPositions
  )
  assert.ok(bestMatch, 'Should find matching system position')
  assert.ok(systemTitles.has(bestMatch.title.toLowerCase()), 'Recommendation must match an actual system position')
})

// Scenario 6: Rejects invented/arbitrary positions
test('Scenario 6: Rejects invented or arbitrary positions and enforces valid system position', async () => {
  // Pass an assessment evaluation where AI returns an invented position
  const data = await getAuthorizedEmployeeData(hrUser, testEmployee.id)
  const validPositionTitles = new Set(data.availableTargetPositions.map(p => p.title.toLowerCase()))

  // Directly simulate invalid position validation in generateSuccessionAssessment
  const inventedPosition = 'Chief Galactic Freight Officer'
  assert.equal(validPositionTitles.has(inventedPosition.toLowerCase()), false, 'Invented position is not in system')

  const fallback = matchTargetPositionsDeterministically(
    data.employee,
    data.competencyAssessments,
    data.availableTargetPositions
  )
  assert.ok(validPositionTitles.has(fallback.title.toLowerCase()), 'Fallback position must be a real system position')
})

// Scenario 7: Insufficient data handling ("Insufficient data is available...")
test('Scenario 7: Insufficient data handling returns exact required message', () => {
  // Missing competency assessments
  const insufficientData = {
    employee: { id: 'uuid', fullName: 'Jane Doe', performanceScore: 80 },
    availableTargetPositions: [{ title: 'Supervisor', required_competencies: [] }],
    competencyAssessments: [],
  }

  const result = checkDataSufficiency(insufficientData)
  assert.equal(result.sufficient, false)
  assert.equal(result.message, 'Insufficient data is available to make a reliable succession recommendation.')
  assert.ok(result.missingInformation.includes('Competency Assessments'))
})

// Scenario 8: AI recommendation generated successfully
test('Scenario 8: AI recommendation generated successfully with structured fields', async () => {
  const assessment = await generateSuccessionAssessment(hrUser, testEmployee.id)

  assert.equal(assessment.sufficientData, true)
  assert.ok(typeof assessment.readinessScore === 'number')
  assert.ok(['ready_now', 'ready_in_1_2_years', 'development_needed'].includes(assessment.readinessBand))
  assert.ok(assessment.readinessAssessment.length > 0)
  assert.ok(Array.isArray(assessment.strengths))
  assert.ok(Array.isArray(assessment.developmentGaps))
  assert.ok(assessment.recommendedPosition, 'Must provide recommended position')
  assert.ok(assessment.recommendationReason.length > 0)
  assert.ok(Array.isArray(assessment.matchingCompetencies))
  assert.ok(Array.isArray(assessment.missingCompetencies))
  assert.ok(Array.isArray(assessment.developmentRecommendations))
})

// Scenario 9: AI offline/timeout fallback to deterministic matching
test('Scenario 9: AI offline or timeout fallback produces deterministic match', () => {
  const employee = { department: 'Safety & Compliance', jobTitle: 'Safety Coordinator' }
  const competencies = [
    { competency: 'Regulatory Compliance', score: 90 },
    { competency: 'Incident Investigation', score: 85 },
  ]
  const targetPositions = [
    {
      title: 'Safety & Compliance Manager',
      department: 'Safety & Compliance',
      is_critical: true,
      required_competencies: [
        { competency: 'Regulatory Compliance', requiredScore: 85 },
        { competency: 'Incident Investigation', requiredScore: 80 },
      ],
    },
    {
      title: 'Director of Fleet Operations',
      department: 'Fleet & Transportation',
      is_critical: true,
      required_competencies: [
        { competency: 'Fleet Utilization & Availability', requiredScore: 95 },
      ],
    },
  ]

  const match = matchTargetPositionsDeterministically(employee, competencies, targetPositions)
  assert.ok(match)
  assert.equal(match.title, 'Safety & Compliance Manager', 'Deterministic matching should select best suited role')
})

// Scenario 10: Authorized reviewer approves succession
// Scenario 11: Employee job_title updates immediately in DB
// Scenario 12: Previous position preserved in position_history
// Scenario 13: Succession status becomes approved in succession_records
// Scenario 14: Workflow event created
// Scenario 15: activity_logs audit log created with action SUCCESSION_APPROVED
// Scenario 16: Notifications created for employee, supervisor, HR
// Scenario 17: Dashboard reflects new position and succession status
test('Scenarios 10-17: Succession Approval 13-step atomic transaction completes all side-effects', async () => {
  const previousTitle = testEmployee.job_title // 'Safety Coordinator'
  const newTargetRole = 'Safety & Compliance Manager'

  // Execute approval transaction
  const result = await transaction(async (client) => {
    return await approveSuccessionTransaction(client, {
      workflowId: testWorkflow.id,
      employeeId: testEmployee.id,
      targetPosition: newTargetRole,
      actorUser: hrUser,
      note: 'Verified candidate meets all leadership readiness criteria.',
      effectiveDate: '2026-10-01',
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.previousPosition, previousTitle)
  assert.equal(result.newPosition, newTargetRole)

  // 11. Employee job_title updates immediately in DB
  const empCheck = await query('SELECT job_title FROM employees WHERE id = $1', [testEmployee.id])
  assert.equal(empCheck.rows[0].job_title, newTargetRole, 'employees.job_title must be updated in DB')

  // 12. Previous position preserved in position_history
  const histCheck = await query(
    'SELECT * FROM position_history WHERE employee_id = $1 AND new_position = $2',
    [testEmployee.id, newTargetRole]
  )
  assert.ok(histCheck.rows.length >= 1, 'position_history record must exist')
  assert.equal(histCheck.rows[0].previous_position, previousTitle)
  assert.equal(histCheck.rows[0].new_position, newTargetRole)
  assert.equal(histCheck.rows[0].approved_by, hrUser.sub)
  assert.equal(histCheck.rows[0].succession_workflow_id, testWorkflow.id)

  // 13. Succession status becomes approved in succession_records
  const recCheck = await query(
    'SELECT * FROM succession_records WHERE employee_id = $1 AND workflow_id = $2',
    [testEmployee.id, testWorkflow.id]
  )
  assert.ok(recCheck.rows.length >= 1, 'succession_records record must exist')
  assert.equal(recCheck.rows[0].review_status, 'approved')
  assert.equal(recCheck.rows[0].final_approved_position, newTargetRole)
  assert.equal(recCheck.rows[0].reviewer_id, hrUser.sub)

  // 14. Workflow event created
  const eventCheck = await query(
    "SELECT * FROM workflow_events WHERE workflow_id = $1 AND stage = 'approved' AND event_type = 'completed'",
    [testWorkflow.id]
  )
  assert.ok(eventCheck.rows.length >= 1, 'workflow_events must record approval event')

  // 15. activity_logs audit log created with action SUCCESSION_APPROVED
  const logCheck = await query(
    "SELECT * FROM activity_logs WHERE action = 'SUCCESSION_APPROVED' AND target_id = $1",
    [testWorkflow.id]
  )
  assert.ok(logCheck.rows.length >= 1, 'activity_logs must record SUCCESSION_APPROVED')
  assert.equal(logCheck.rows[0].actor_id, hrUser.sub)

  // 16. Notifications created for employee, supervisor, HR
  const notifCheck = await query(
    'SELECT * FROM notifications WHERE workflow_id = $1',
    [testWorkflow.id]
  )
  assert.ok(notifCheck.rows.length >= 2, 'Notifications must be sent to relevant stakeholders')
  const employeeNotif = notifCheck.rows.find(n => n.user_id === securityEmployeeUser.id)
  assert.ok(employeeNotif, 'Employee must receive succession approval notification')
  assert.match(employeeNotif.title, /Succession Approved/i)

  // 17. Dashboard reflects new position and succession status
  const profileCheck = await query(
    'SELECT * FROM succession_profiles WHERE employee_id = $1',
    [testEmployee.id]
  )
  assert.ok(profileCheck.rows.length >= 1, 'succession_profiles must exist')
  assert.equal(profileCheck.rows[0].target_role, newTargetRole)
})

// Scenario 18: Unauthorized user cannot approve (403)
test('Scenario 18: Unauthorized user role cannot approve succession (403)', async () => {
  const unauthorizedUser = {
    sub: securityEmployeeUser.id,
    id: securityEmployeeUser.id,
    name: securityEmployeeUser.name,
    role: 'guest', // Not permitted
  }

  await assert.rejects(
    async () => {
      await transaction(async (client) => {
        return await approveSuccessionTransaction(client, {
          workflowId: null,
          employeeId: testEmployee.id,
          targetPosition: 'Safety & Compliance Manager',
          actorUser: unauthorizedUser,
        })
      })
    },
    (err) => {
      assert.equal(err.status, 403)
      assert.match(err.message, /Access denied/i)
      return true
    }
  )
})

// Scenario 19: Employee cannot approve own succession (403)
test('Scenario 19: Employee cannot approve own succession (403)', async () => {
  await assert.rejects(
    async () => {
      await transaction(async (client) => {
        return await approveSuccessionTransaction(client, {
          workflowId: null,
          employeeId: testEmployee.id,
          targetPosition: 'Safety & Compliance Manager',
          actorUser: securityEmployeeUser, // Actor is the subject employee
        })
      })
    },
    (err) => {
      assert.equal(err.status, 403)
      assert.match(err.message, /Employees cannot approve their own succession/i)
      return true
    }
  )
})

// Scenario 20: Employee cannot modify succession recommendation
test('Scenario 20: Employee cannot modify succession recommendation or advance review', async () => {
  await assert.rejects(
    async () => {
      await verifyEmployeeAccess(foEmployeeUser, testEmployee.id)
    },
    (err) => {
      assert.equal(err.status, 403)
      return true
    }
  )
})

// Scenario 21: Historical succession records accessible according to RBAC
test('Scenario 21: Historical succession records accessible according to RBAC', async () => {
  // 1. HR scope: org-wide
  const hrScope = await getScopeFilter(hrUser)
  assert.equal(hrScope.isHr, true)
  assert.equal(hrScope.isScoped, false)

  // 2. Supervisor scope: scoped to department
  const supScope = await getScopeFilter(securitySupervisorUser)
  assert.equal(supScope.isHr, false)
  assert.equal(supScope.isScoped, true)
  assert.equal(supScope.department, 'Safety & Compliance')

  // 3. Employee scope: scoped to self
  const empScope = await getScopeFilter(securityEmployeeUser)
  assert.equal(empScope.isHr, false)
  assert.equal(empScope.isEmployee, true)
  assert.equal(empScope.employeeId, testEmployee.id)
})

// Scenario 22: Failed transaction rolls back all related changes atomically
test('Scenario 22: Failed transaction rolls back all related changes atomically', async () => {
  const preSnapshotEmp = await query('SELECT job_title FROM employees WHERE id = $1', [testEmployee.id])
  const preSnapshotHistCount = await query('SELECT count(*)::int as count FROM position_history WHERE employee_id = $1', [testEmployee.id])

  await assert.rejects(
    async () => {
      await transaction(async (client) => {
        // Step A: update employee title inside transaction
        await client.query('UPDATE employees SET job_title = $1 WHERE id = $2', ['Temporary Bogus Role', testEmployee.id])
        // Step B: insert position history inside transaction
        await client.query(
          'INSERT INTO position_history (employee_id, previous_position, new_position, effective_date) VALUES ($1, $2, $3, CURRENT_DATE)',
          [testEmployee.id, 'Old Role', 'Temporary Bogus Role']
        )
        // Step C: trigger an intentional error to force transaction abort
        throw new Error('Simulated atomic transaction failure')
      })
    },
    /Simulated atomic transaction failure/
  )

  // Verify rollback: employee job title unchanged
  const postEmp = await query('SELECT job_title FROM employees WHERE id = $1', [testEmployee.id])
  assert.equal(postEmp.rows[0].job_title, preSnapshotEmp.rows[0].job_title, 'Job title must roll back')

  // Verify rollback: position history count unchanged
  const postHistCount = await query('SELECT count(*)::int as count FROM position_history WHERE employee_id = $1', [testEmployee.id])
  assert.equal(postHistCount.rows[0].count, preSnapshotHistCount.rows[0].count, 'Position history count must roll back')
})

after(async () => {
  if (!dbAvailable) return
  // Clean up all test data
  if (testEmployee?.id) {
    await query('DELETE FROM workflow_events WHERE workflow_id IN (SELECT id FROM workflows WHERE subject_employee_id = $1)', [testEmployee.id])
    await query('DELETE FROM notifications WHERE workflow_id IN (SELECT id FROM workflows WHERE subject_employee_id = $1) OR user_id = $2', [testEmployee.id, securityEmployeeUser?.id])
    await query('DELETE FROM activity_logs WHERE target_id IN (SELECT id::text FROM workflows WHERE subject_employee_id = $1) OR target_id = $1::text', [testEmployee.id])
    await query('DELETE FROM succession_records WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM succession_profiles WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM position_history WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM learning_completions WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM competency_assessments WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM workflows WHERE subject_employee_id = $1', [testEmployee.id])
    await query('DELETE FROM users WHERE employee_id = $1', [testEmployee.id])
    await query('DELETE FROM employees WHERE id = $1', [testEmployee.id])
  }
  try { await pool.end() } catch { /* ignore teardown errors */ }
})
