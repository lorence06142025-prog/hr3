import { query } from '../db.js'
import { calculateReadiness } from './metrics.js'
import { verifyEmployeeAccess, getUserDepartment } from './departmentScope.js'
import { generateAiSuccessionRecommendation } from './openrouter.js'

/**
 * Retrieve authorized employee data for succession assessment.
 * Applies RBAC and organizational scope before retrieving data.
 * Does NOT perform an unrestricted database dump.
 */
export async function getAuthorizedEmployeeData(user, employeeId) {
  if (!user) {
    throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  }
  if (!employeeId) {
    throw Object.assign(new Error('Employee ID is required.'), { status: 400 })
  }

  // 1. Enforce RBAC & department scope
  const targetEmployee = await verifyEmployeeAccess(user, employeeId)

  // 2. Query specific authorized fields from employees table
  const empRes = await query(
    `SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
            e.manager_id, e.performance_score, e.competency_score, e.learning_progress, e.is_active,
            m.full_name AS manager_name, m.job_title AS manager_title
     FROM employees e
     LEFT JOIN employees m ON m.id = e.manager_id
     WHERE e.id = $1 AND e.is_active = true`,
    [employeeId]
  )
  const employee = empRes.rows[0]
  if (!employee) {
    throw Object.assign(new Error('Active employee record not found.'), { status: 404 })
  }

  // 3. Query historical performance score snapshots (score_history)
  const historyRes = await query(
    `SELECT performance_score, competency_score, learning_progress, recorded_at
     FROM score_history
     WHERE employee_id = $1
     ORDER BY recorded_at DESC
     LIMIT 10`,
    [employeeId]
  )

  // 4. Query competency assessments and identify competency gaps
  const compRes = await query(
    `SELECT competency, score, required_score, source, assessed_at
     FROM competency_assessments
     WHERE employee_id = $1
     ORDER BY competency ASC`,
    [employeeId]
  )
  const competencyAssessments = compRes.rows
  const competencyGaps = competencyAssessments
    .filter(c => Number(c.score) < Number(c.required_score))
    .map(c => ({
      competency: c.competency,
      score: Number(c.score),
      requiredScore: Number(c.required_score),
      gap: Number(c.required_score) - Number(c.score),
    }))

  // 5. Query completed learning resources
  const learningRes = await query(
    `SELECT lc.completed_at, lc.assessment_result, lr.title, lr.category, lr.provider
     FROM learning_completions lc
     JOIN learning_resources lr ON lr.id = lc.resource_id
     WHERE lc.employee_id = $1
     ORDER BY lc.completed_at DESC
     LIMIT 15`,
    [employeeId]
  )

  // 6. Query training history (participated sessions)
  const trainingRes = await query(
    `SELECT ts.title, ts.category, ts.start_date, tp.attendance, tp.status
     FROM training_participants tp
     JOIN training_sessions ts ON ts.id = tp.session_id
     WHERE tp.employee_id = $1 AND (tp.attendance IN ('present', 'late') OR tp.status = 'completed')
     ORDER BY ts.start_date DESC
     LIMIT 15`,
    [employeeId]
  )

  // 7. Query authorized available target positions in the system
  // Filter by department scope: supervisors only see positions in their department; HR and management see all positions
  let targetPositionsSql = 'SELECT id, title, department, is_critical, description, required_competencies, required_learning, min_performance_score, min_competency_score, min_learning_progress FROM positions'
  const targetParams = []

  if (user.role === 'supervisor' || user.role === 'operations_manager') {
    const userDept = await getUserDepartment(user)
    if (userDept.department) {
      targetParams.push(userDept.department)
      targetPositionsSql += ` WHERE department = $1`
    }
  }
  targetPositionsSql += ' ORDER BY is_critical DESC, title ASC'

  const posRes = await query(targetPositionsSql, targetParams)
  const availableTargetPositions = posRes.rows

  // 8. Deterministic readiness score
  const readiness = calculateReadiness({
    performance: employee.performance_score,
    competency: employee.competency_score,
    learning: employee.learning_progress,
  })

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employee_number,
      fullName: employee.full_name,
      department: employee.department,
      jobTitle: employee.job_title,
      managerId: employee.manager_id,
      managerName: employee.manager_name,
      managerTitle: employee.manager_title,
      performanceScore: Number(employee.performance_score || 0),
      competencyScore: Number(employee.competency_score || 0),
      learningProgress: Number(employee.learning_progress || 0),
    },
    performanceHistory: historyRes.rows,
    competencyAssessments,
    competencyGaps,
    completedLearning: learningRes.rows,
    trainingHistory: trainingRes.rows,
    availableTargetPositions,
    readinessScore: readiness.score,
    readinessBand: readiness.band,
  }
}

/**
 * Validates whether the employee profile and positions have sufficient data for recommendation.
 */
export function checkDataSufficiency(employeeData) {
  const missing = []
  if (!employeeData.employee) missing.push('Employee Profile')
  if (!employeeData.availableTargetPositions || employeeData.availableTargetPositions.length === 0) {
    missing.push('Available Target Positions')
  }
  if (employeeData.employee.performanceScore === undefined || employeeData.employee.performanceScore === null) {
    missing.push('Performance Score')
  }
  if (!employeeData.competencyAssessments || employeeData.competencyAssessments.length === 0) {
    missing.push('Competency Assessments')
  }

  if (missing.length > 0) {
    return {
      sufficient: false,
      message: 'Insufficient data is available to make a reliable succession recommendation.',
      missingInformation: missing,
    }
  }

  return { sufficient: true }
}

/**
 * Deterministic fallback succession position comparator.
 * Compares current employee competency scores against each target position's required competencies.
 */
export function matchTargetPositionsDeterministically(employee, competencyAssessments, targetPositions) {
  if (!targetPositions || !targetPositions.length) return null

  // Exclude current position
  const candidatePositions = targetPositions.filter(p => p.title.toLowerCase() !== (employee.jobTitle || '').toLowerCase())
  const pool = candidatePositions.length > 0 ? candidatePositions : targetPositions

  const compMap = new Map()
  for (const ca of competencyAssessments || []) {
    compMap.set((ca.competency || '').toLowerCase(), Number(ca.score || 0))
  }

  let bestMatch = null
  let bestScore = -1

  for (const pos of pool) {
    const reqs = Array.isArray(pos.required_competencies) ? pos.required_competencies : []
    let matchCount = 0
    let totalScore = 0

    for (const r of reqs) {
      const actual = compMap.get((r.competency || '').toLowerCase()) || 0
      const target = Number(r.requiredScore || 80)
      if (actual >= target) matchCount++
      totalScore += Math.min(100, (actual / (target || 80)) * 100)
    }

    const avgMatch = reqs.length > 0 ? totalScore / reqs.length : 70
    // Give slight preference to same-department and critical positions
    const deptBonus = (pos.department === employee.department) ? 5 : 0
    const critBonus = pos.is_critical ? 3 : 0
    const finalRank = avgMatch + deptBonus + critBonus

    if (finalRank > bestScore) {
      bestScore = finalRank
      bestMatch = pos
    }
  }

  return bestMatch || pool[0]
}

/**
 * Generate AI Succession Assessment & Critical Role Recommendation.
 * AI never replaces official deterministic readiness score.
 * AI only recommends from actual system positions.
 */
export async function generateSuccessionAssessment(user, employeeId, options = {}) {
  // 1. Retrieve authorized data
  const data = await getAuthorizedEmployeeData(user, employeeId)

  // 2. Check for sufficient data
  const sufficiency = checkDataSufficiency(data)
  if (!sufficiency.sufficient) {
    return {
      readinessScore: data.readinessScore,
      readinessBand: data.readinessBand,
      sufficientData: false,
      message: sufficiency.message,
      missingInformation: sufficiency.missingInformation,
      readinessAssessment: sufficiency.message,
      strengths: [],
      developmentGaps: [],
      recommendedPosition: null,
      recommendationReason: sufficiency.message,
      matchingCompetencies: [],
      missingCompetencies: [],
      developmentRecommendations: ['Complete required performance reviews, competency assessments, and learning modules before requesting succession recommendation.'],
      targetPositions: data.availableTargetPositions,
    }
  }

  // 3. Fallback baseline comparator
  const fallbackPosition = matchTargetPositionsDeterministically(
    data.employee,
    data.competencyAssessments,
    data.availableTargetPositions
  )

  const compMap = new Map()
  for (const ca of data.competencyAssessments || []) {
    compMap.set((ca.competency || '').toLowerCase(), Number(ca.score || 0))
  }

  const fallbackReqs = Array.isArray(fallbackPosition?.required_competencies) ? fallbackPosition.required_competencies : []
  const matchingComps = []
  const missingComps = []

  for (const r of fallbackReqs) {
    const actual = compMap.get((r.competency || '').toLowerCase()) || 0
    const req = Number(r.requiredScore || 80)
    if (actual >= req) {
      matchingComps.push(`${r.competency} (${actual}% >= ${req}%)`)
    } else {
      missingComps.push(`${r.competency} (${actual}% vs ${req}% required)`)
    }
  }

  // 4. Call AI recommendation service with authorized data only
  let aiResult = null
  try {
    aiResult = await generateAiSuccessionRecommendation({
      employee: data.employee,
      readinessScore: data.readinessScore,
      readinessBand: data.readinessBand,
      performanceHistory: data.performanceHistory,
      competencyAssessments: data.competencyAssessments,
      competencyGaps: data.competencyGaps,
      completedLearning: data.completedLearning,
      trainingHistory: data.trainingHistory,
      targetPositions: data.availableTargetPositions,
    })
  } catch (err) {
    console.warn('[successionService] AI recommendation error, using deterministic matching:', err.message)
  }

  // 5. Validate AI response: recommendedPosition MUST strictly be in availableTargetPositions
  const validPositionTitles = new Set(data.availableTargetPositions.map(p => p.title.toLowerCase()))
  let finalRecommendedPosition = aiResult?.recommendedPosition

  if (!finalRecommendedPosition || !validPositionTitles.has(finalRecommendedPosition.toLowerCase())) {
    // If AI invented a position or returned invalid name, enforce valid system position
    finalRecommendedPosition = fallbackPosition?.title || null
  }

  // Match the exact casing from database
  const matchedDbPos = data.availableTargetPositions.find(p => p.title.toLowerCase() === (finalRecommendedPosition || '').toLowerCase())
  finalRecommendedPosition = matchedDbPos?.title || fallbackPosition?.title || 'Senior Associate'

  // Build final structured explainable assessment
  const result = {
    sufficientData: true,
    readinessScore: data.readinessScore,
    readinessBand: data.readinessBand,
    readinessAssessment: aiResult?.readinessAssessment || `Employee holds an official readiness score of ${data.readinessScore}% (${data.readinessBand.replaceAll('_', ' ')}), reflecting strong performance (${data.employee.performanceScore}%), solid competency foundations (${data.employee.competencyScore}%), and consistent learning completion (${data.employee.learningProgress}%).`,
    strengths: (aiResult?.strengths && aiResult.strengths.length > 0)
      ? aiResult.strengths
      : [
          `Strong operational performance at ${data.employee.performanceScore}%.`,
          `Verified competency benchmark standing at ${data.employee.competencyScore}%.`,
          `${data.completedLearning.length} completed learning modules on record.`,
        ],
    developmentGaps: (aiResult?.developmentGaps && aiResult.developmentGaps.length > 0)
      ? aiResult.developmentGaps
      : data.competencyGaps.map(g => `${g.competency} (Gap: -${g.gap} points)`),
    recommendedPosition: finalRecommendedPosition,
    recommendationReason: aiResult?.recommendationReason || `Recommended for ${finalRecommendedPosition} based on alignment with departmental capability benchmarks in ${data.employee.department} and leadership pipeline depth.`,
    matchingCompetencies: (aiResult?.matchingCompetencies && aiResult.matchingCompetencies.length > 0)
      ? aiResult.matchingCompetencies
      : matchingComps,
    missingCompetencies: (aiResult?.missingCompetencies && aiResult.missingCompetencies.length > 0)
      ? aiResult.missingCompetencies
      : missingComps,
    developmentRecommendations: (aiResult?.developmentRecommendations && aiResult.developmentRecommendations.length > 0)
      ? aiResult.developmentRecommendations
      : [
          `Enroll in targeted leadership and supervisory development paths for ${finalRecommendedPosition}.`,
          `Undergo mentor shadowing with current ${finalRecommendedPosition} role holders.`,
          `Complete practical operational projects to close identified competency gaps.`,
        ],
    targetPositions: data.availableTargetPositions,
    employee: data.employee,
  }

  return result
}

/**
 * Atomic 13-step transaction for approving succession.
 * Rolls back completely on failure.
 */
export async function approveSuccessionTransaction(client, {
  workflowId,
  employeeId,
  targetPosition,
  actorUser,
  note = 'Approved Succession',
  effectiveDate = null,
}) {
  // 1. Validate authenticated user
  if (!actorUser) {
    throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  }

  // 2. Validate approval permission: Employee cannot approve own succession!
  if (actorUser.employeeId && actorUser.employeeId === employeeId) {
    throw Object.assign(new Error('Access denied: Employees cannot approve their own succession.'), { status: 403 })
  }

  // 3. Validate RBAC
  if (!['hr', 'management', 'supervisor', 'operations_manager'].includes(actorUser.role)) {
    throw Object.assign(new Error('Access denied: You do not have permission to approve succession.'), { status: 403 })
  }

  // 4. Validate organizational scope & fetch employee FOR UPDATE
  const empRes = await client.query(
    'SELECT id, employee_number, full_name, department, job_title, performance_score, competency_score, learning_progress, is_active FROM employees WHERE id = $1 FOR UPDATE',
    [employeeId]
  )
  const employee = empRes.rows[0]
  if (!employee) {
    throw Object.assign(new Error('Target employee not found.'), { status: 404 })
  }

  if (actorUser.role === 'supervisor' || actorUser.role === 'operations_manager') {
    const userDept = await getUserDepartment(actorUser)
    if (employee.department !== userDept.department) {
      throw Object.assign(new Error(`Access denied: Target employee belongs to ${employee.department}, outside your assigned department (${userDept.department}).`), { status: 403 })
    }
  }

  // 5. Validate workflow stage if workflowId is provided
  let workflow = null
  if (workflowId) {
    const wfRes = await client.query('SELECT * FROM workflows WHERE id = $1 FOR UPDATE', [workflowId])
    workflow = wfRes.rows[0]
    if (!workflow) {
      throw Object.assign(new Error('Workflow not found.'), { status: 404 })
    }
    if (workflow.status !== 'active') {
      throw Object.assign(new Error('This succession workflow is already complete or cancelled.'), { status: 409 })
    }
  }

  // 6. Validate target position: Must be a valid system position!
  const posRes = await client.query('SELECT title, department, is_critical FROM positions WHERE LOWER(title) = LOWER($1)', [targetPosition])
  if (!posRes.rows[0]) {
    // Check if it exists as an existing job_title in employees
    const empTitleRes = await client.query('SELECT DISTINCT job_title FROM employees WHERE LOWER(job_title) = LOWER($1)', [targetPosition])
    if (!empTitleRes.rows[0]) {
      throw Object.assign(new Error(`Target position "${targetPosition}" is not a recognized system position.`), { status: 400 })
    }
  }
  const officialTargetPosition = posRes.rows[0]?.title || targetPosition

  const previousPosition = employee.job_title
  const readiness = calculateReadiness({
    performance: employee.performance_score,
    competency: employee.competency_score,
    learning: employee.learning_progress,
  })

  // 7. Update succession status in succession_records
  const recordRes = await client.query(
    `INSERT INTO succession_records (
       employee_id, workflow_id, current_position, recommended_position,
       readiness_score, readiness_band, review_status, reviewer_id,
       approval_date, final_approved_position, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, NOW(), $8, $9)
     RETURNING *`,
    [
      employee.id,
      workflowId || null,
      previousPosition,
      officialTargetPosition,
      readiness.score,
      readiness.band,
      actorUser.sub,
      officialTargetPosition,
      note,
    ]
  )
  const successionRecord = recordRes.rows[0]

  // 8. Update employee current position immediately
  const updatedEmpRes = await client.query(
    `UPDATE employees
     SET job_title = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, employee_number, full_name, department, job_title, performance_score, competency_score, learning_progress, updated_at`,
    [officialTargetPosition, employee.id]
  )
  const updatedEmployee = updatedEmpRes.rows[0]

  // 9. Preserve previous position in position_history
  const posHistRes = await client.query(
    `INSERT INTO position_history (
       employee_id, previous_position, new_position, effective_date,
       reason, approved_by, succession_workflow_id
     )
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7)
     RETURNING *`,
    [
      employee.id,
      previousPosition,
      officialTargetPosition,
      effectiveDate || null,
      note || 'Approved Succession',
      actorUser.sub,
      workflowId || null,
    ]
  )
  const positionHistoryRecord = posHistRes.rows[0]

  // 10. Update succession_profiles for backward-compatible analytics
  await client.query(
    `INSERT INTO succession_profiles (employee_id, readiness_score, readiness_band, target_role, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (employee_id)
     DO UPDATE SET
       readiness_score = EXCLUDED.readiness_score,
       readiness_band = EXCLUDED.readiness_band,
       target_role = EXCLUDED.target_role,
       updated_at = NOW()`,
    [employee.id, readiness.score, readiness.band, officialTargetPosition]
  )

  // 11. Create workflow event & complete workflow
  if (workflowId) {
    await client.query(
      `UPDATE workflows
       SET status = 'completed', current_stage = 'approved', completed_at = NOW(), updated_at = NOW(),
           metadata = metadata || $2::jsonb
       WHERE id = $1`,
      [
        workflowId,
        JSON.stringify({
          successionApproved: true,
          previousPosition,
          newPosition: officialTargetPosition,
          approvedBy: actorUser.name,
          approvalDate: new Date().toISOString(),
        }),
      ]
    )

    await client.query(
      `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details)
       VALUES ($1, 'approved', 'completed', $2, $3, $4)`,
      [
        workflowId,
        actorUser.sub,
        note || 'Succession approved and employee promoted.',
        JSON.stringify({
          previousPosition,
          newPosition: officialTargetPosition,
          effectiveDate: positionHistoryRecord.effective_date,
          approvedBy: actorUser.name,
        }),
      ]
    )
  }

  // 12. Create audit log in activity_logs
  await client.query(
    `INSERT INTO activity_logs (
       actor_id, actor_role, actor_name, action, category,
       target_id, description, details
     )
     VALUES ($1, $2, $3, 'SUCCESSION_APPROVED', 'workflow', $4, $5, $6)`,
    [
      actorUser.sub,
      actorUser.role,
      actorUser.name,
      workflowId || employee.id,
      `${actorUser.name} approved succession for ${employee.full_name}: ${previousPosition} → ${officialTargetPosition}`,
      JSON.stringify({
        employeeId: employee.id,
        employeeNumber: employee.employee_number,
        employeeName: employee.full_name,
        previousPosition,
        newPosition: officialTargetPosition,
        targetPosition: officialTargetPosition,
        workflowId: workflowId || null,
        successionRecordId: successionRecord.id,
        effectiveDate: positionHistoryRecord.effective_date,
      }),
    ]
  )

  // 13. Create notifications
  // Notification for Employee
  const userEmpRes = await client.query('SELECT id FROM users WHERE employee_id = $1 AND is_active = true', [employee.id])
  if (userEmpRes.rows[0]) {
    await client.query(
      `INSERT INTO notifications (user_id, workflow_id, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        userEmpRes.rows[0].id,
        workflowId || null,
        'Succession Approved',
        `Congratulations! Your succession to ${officialTargetPosition} has been approved effective ${positionHistoryRecord.effective_date}.`,
      ]
    )
  }

  // Notification for Supervisor
  if (employee.manager_id) {
    const mgrUserRes = await client.query('SELECT id FROM users WHERE employee_id = $1 AND is_active = true', [employee.manager_id])
    if (mgrUserRes.rows[0]) {
      await client.query(
        `INSERT INTO notifications (user_id, workflow_id, title, message)
         VALUES ($1, $2, $3, $4)`,
        [
          mgrUserRes.rows[0].id,
          workflowId || null,
          'Succession Approved',
          `Succession approved: ${employee.full_name} has been promoted to ${officialTargetPosition}.`,
        ]
      )
    }
  }

  // Notification for HR
  const hrUsers = await client.query("SELECT id FROM users WHERE role = 'hr' AND is_active = true")
  for (const hr of hrUsers.rows) {
    if (hr.id !== actorUser.sub) {
      await client.query(
        `INSERT INTO notifications (user_id, workflow_id, title, message)
         VALUES ($1, $2, $3, $4)`,
        [
          hr.id,
          workflowId || null,
          'Succession Approval Completed',
          `Succession approval completed for ${employee.full_name} (${previousPosition} → ${officialTargetPosition}) by ${actorUser.name}.`,
        ]
      )
    }
  }

  return {
    success: true,
    employee: updatedEmployee,
    previousPosition,
    newPosition: officialTargetPosition,
    positionHistory: positionHistoryRecord,
    successionRecord,
    workflowId: workflowId || null,
  }
}

/**
 * Return succession workflow for revision.
 */
export async function returnSuccessionTransaction(client, {
  workflowId,
  actorUser,
  note = 'Returned for revision',
  targetStage = 'initiate',
}) {
  if (!actorUser) throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  if (!['hr', 'management', 'supervisor', 'operations_manager'].includes(actorUser.role)) {
    throw Object.assign(new Error('Access denied.'), { status: 403 })
  }

  const wfRes = await client.query('SELECT * FROM workflows WHERE id = $1 FOR UPDATE', [workflowId])
  const workflow = wfRes.rows[0]
  if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
  if (workflow.status !== 'active') throw Object.assign(new Error('Workflow is not active.'), { status: 409 })

  if (actorUser.employeeId && actorUser.employeeId === workflow.subject_employee_id) {
    throw Object.assign(new Error('Employees cannot review their own succession.'), { status: 403 })
  }

  await client.query(
    'UPDATE workflows SET current_stage = $1, updated_at = NOW() WHERE id = $2',
    [targetStage, workflowId]
  )

  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details)
     VALUES ($1, $2, 'returned', $3, $4, $5)`,
    [
      workflowId,
      targetStage,
      actorUser.sub,
      note,
      JSON.stringify({ returnedFrom: workflow.current_stage, targetStage, returnedBy: actorUser.name }),
    ]
  )

  await client.query(
    `INSERT INTO activity_logs (actor_id, actor_role, actor_name, action, category, target_id, description, details)
     VALUES ($1, $2, $3, 'workflow.return', 'workflow', $4, $5, $6)`,
    [
      actorUser.sub,
      actorUser.role,
      actorUser.name,
      workflowId,
      `${actorUser.name} returned succession workflow for revision: ${note}`,
      JSON.stringify({ workflowId, targetStage, note }),
    ]
  )

  return { returned: true, stage: targetStage }
}

/**
 * Reject succession workflow.
 */
export async function rejectSuccessionTransaction(client, {
  workflowId,
  actorUser,
  reason = 'Succession nomination rejected',
}) {
  if (!actorUser) throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  if (!['hr', 'management', 'supervisor', 'operations_manager'].includes(actorUser.role)) {
    throw Object.assign(new Error('Access denied.'), { status: 403 })
  }

  const wfRes = await client.query('SELECT * FROM workflows WHERE id = $1 FOR UPDATE', [workflowId])
  const workflow = wfRes.rows[0]
  if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
  if (workflow.status !== 'active') throw Object.assign(new Error('Workflow is not active.'), { status: 409 })

  if (actorUser.employeeId && actorUser.employeeId === workflow.subject_employee_id) {
    throw Object.assign(new Error('Employees cannot review their own succession.'), { status: 403 })
  }

  await client.query(
    "UPDATE workflows SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
    [workflowId]
  )

  await client.query(
    `INSERT INTO succession_records (employee_id, workflow_id, current_position, review_status, reviewer_id, approval_date, notes)
     VALUES ($1, $2, (SELECT job_title FROM employees WHERE id = $1), 'rejected', $3, NOW(), $4)`,
    [workflow.subject_employee_id, workflowId, actorUser.sub, reason]
  )

  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details)
     VALUES ($1, $2, 'cancelled', $3, $4, $5)`,
    [workflowId, workflow.current_stage, actorUser.sub, reason, JSON.stringify({ rejectedBy: actorUser.name })]
  )

  await client.query(
    `INSERT INTO activity_logs (actor_id, actor_role, actor_name, action, category, target_id, description, details)
     VALUES ($1, $2, $3, 'SUCCESSION_REJECTED', 'workflow', $4, $5, $6)`,
    [
      actorUser.sub,
      actorUser.role,
      actorUser.name,
      workflowId,
      `${actorUser.name} rejected succession nomination: ${reason}`,
      JSON.stringify({ workflowId, reason }),
    ]
  )

  return { rejected: true, workflowId }
}
