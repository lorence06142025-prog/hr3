const SCORE_FIELDS = {
  performance: 'performance_score',
  competency: 'competency_score',
  learning: 'learning_progress',
}

const clampScore = value => {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.min(100, Math.max(0, Math.round(number * 100) / 100))
}

const parseNumericTarget = (target, defaultVal = 100) => {
  if (typeof target === 'number' && Number.isFinite(target) && target > 0) return target
  if (typeof target === 'string') {
    const matched = target.match(/(\d+(\.\d+)?)/)
    if (matched) {
      const num = parseFloat(matched[1])
      if (num > 0) return num
    }
  }
  return defaultVal
}

const calculateKpiContribution = (score, target, weight) => {
  const s = Number(score) || 0
  const t = parseNumericTarget(target, 100)
  const w = Number(weight) || 0
  const achievement = t > 0 ? s / t : s / 100
  const contribution = achievement * w
  return Math.round(contribution * 100) / 100
}

const formFromDetails = details => {
  if (!details || typeof details !== 'object') return {}
  return details.formData && typeof details.formData === 'object' ? details.formData : details
}

const scoreFromKeys = (source, keys) => {
  if (!source || typeof source !== 'object') return null
  for (const key of keys) {
    const score = clampScore(source[key])
    if (score !== null) return score
  }
  return null
}

const average = values => {
  const scores = values.map(clampScore).filter(value => value !== null)
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100
}

const weightedKpiAverage = kpis => {
  const rows = (kpis || [])
    .map(kpi => ({
      score: clampScore(kpi?.score),
      weight: Number(kpi?.weight) || 0,
      target: kpi?.target
    }))
    .filter(kpi => kpi.score !== null)
  if (!rows.length) return null
  const totalWeight = rows.reduce((sum, kpi) => sum + (kpi.weight > 0 ? kpi.weight : 0), 0)
  if (totalWeight > 0) {
    const totalWeightedScore = rows.reduce((sum, kpi) => {
      const contribution = calculateKpiContribution(kpi.score, kpi.target, kpi.weight)
      return sum + contribution
    }, 0)
    const normalized = (totalWeightedScore / totalWeight) * 100
    return Math.min(100, Math.max(0, Math.round(normalized * 100) / 100))
  }
  return average(rows.map(kpi => kpi.score))
}

const kpiAverage = form => {
  if (Array.isArray(form?.kpiRatings)) return weightedKpiAverage(form.kpiRatings)
  if (Array.isArray(form?.questions)) return average(form.questions.map(row => Number(row?.rating || 0) * 20))
  const explicit = scoreFromKeys(form, ['overall', 'overallScore', 'averageScore'])
  if (explicit !== null) return explicit
  return null
}

const progressAverage = form => {
  const explicit = scoreFromKeys(form, ['learningProgress', 'progress', 'completion', 'completionRate', 'finalProgress'])
  if (explicit !== null) return explicit
  if (Array.isArray(form)) return average(form.map(row => row?.progress))
  if (Array.isArray(form?.learners)) return average(form.learners.map(row => row?.progress))
  if (Array.isArray(form?.progressRows)) return average(form.progressRows.map(row => row?.progress))
  return null
}

function stageForms(events, finalData = {}) {
  const forms = {}
  // Process in order so the last (most recent) event per stage wins
  for (const event of events || []) {
    const details = event.details || {}
    // Support both { formData: {...} } wrapper and flat details
    const form = Array.isArray(details.formData)
      ? details.formData
      : (details.formData && typeof details.formData === 'object')
      ? { ...details.formData, ...details, formData: undefined }
      : details
    if (event.stage && Object.keys(form).length > 0) {
      forms[event.stage] = form
    }
  }
  if (finalData && Object.keys(finalData).length) {
    const fd = formFromDetails(finalData)
    forms.__finalInput = fd
  }
  return forms
}

function derivePerformanceResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const calibration = forms.calibration || {}
  const supervisor = forms.performance_evaluation || {}
  const self = forms.self_assessment || {}
  const finalInput = forms.__finalInput || {}

  const calibratedScore = scoreFromKeys(calibration, ['finalScore', 'calibratedScore', 'approvedScore', 'performanceScore'])
  if (calibratedScore !== null && !/return/i.test(String(calibration.decision || ''))) {
    return { field: SCORE_FIELDS.performance, newValue: calibratedScore, source: 'calibration', calculation: { decision: calibration.decision || null, employeeAvg: calibration.employeeAvg ?? null, supervisorAvg: calibration.deptAvg ?? null } }
  }

  const finalApprovedScore = scoreFromKeys(finalInput, ['finalScore', 'approvedScore', 'calibratedScore', 'performanceScore'])
  if (finalApprovedScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: finalApprovedScore, source: 'final_approval_or_publish', calculation: { submittedAtCompletion: true } }
  }

  const supervisorScore = kpiAverage(supervisor)
  if (supervisorScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: supervisorScore, source: 'performance_evaluation', calculation: { supervisorOverall: supervisorScore } }
  }

  const explicitScore = clampScore(scores?.performanceScore)
  if (explicitScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: explicitScore, source: 'explicit_scores_payload', calculation: {} }
  }

  const selfScore = kpiAverage(self)
  if (selfScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: selfScore, source: 'self_assessment_fallback', calculation: { selfAssessmentOnly: true } }
  }

  return null
}

function deriveCompetencyResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const updateRecord = forms.update_record || {}
  const trackProgress = forms.track_progress || {}
  const finalInput = forms.__finalInput || {}

  const updateScore = scoreFromKeys(updateRecord, ['newScore', 'competencyScore', 'overallCompetency', 'score', 'finalScore'])
  if (updateScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: updateScore, source: 'update_record', calculation: { recordNotes: updateRecord.reviewNotes || null } }
  }

  const finalScore = scoreFromKeys(finalInput, ['newScore', 'competencyScore', 'overallCompetency', 'score', 'finalScore'])
  if (finalScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: finalScore, source: 'completion_payload', calculation: {} }
  }

  const progressScore = progressAverage(trackProgress)
  if (progressScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: progressScore, source: 'track_progress', calculation: { progressAverage: progressScore } }
  }

  const explicitScore = clampScore(scores?.competencyScore)
  if (explicitScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: explicitScore, source: 'explicit_scores_payload', calculation: {} }
  }

  return null
}

function deriveLearningResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const assessment = forms.assessment || {}
  const finalInput = forms.__finalInput || {}

  const assessmentProgress = progressAverage(assessment)
  if (assessmentProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: assessmentProgress, source: 'assessment', calculation: { progressAverage: assessmentProgress } }
  }

  const finalProgress = progressAverage(finalInput)
  if (finalProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: finalProgress, source: 'completion_payload', calculation: {} }
  }

  const explicitProgress = clampScore(scores?.learningProgress)
  if (explicitProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: explicitProgress, source: 'explicit_scores_payload', calculation: {} }
  }

  return { field: SCORE_FIELDS.learning, newValue: 100, source: 'workflow_completed_default', calculation: { completedLearningWorkflow: true } }
}

export function deriveWorkflowScoreResult(workflow, events, finalData = {}, scores = null) {
  if (!workflow?.subject_employee_id) return null
  if (workflow.module === 'performance') return derivePerformanceResult(events, finalData, scores)
  if (workflow.module === 'competency') return deriveCompetencyResult(events, finalData, scores)
  if (workflow.module === 'learning') return deriveLearningResult(events, finalData, scores)
  return null
}

export async function applyWorkflowScoreWriteBack(client, workflow, events, finalData, scores, actorId) {
  const result = deriveWorkflowScoreResult(workflow, events, finalData, scores)
  if (!result) {
    if (['performance', 'competency', 'learning'].includes(workflow.module) && workflow.subject_employee_id) {
      throw Object.assign(new Error(`Cannot complete ${workflow.module} workflow because no final employee score could be calculated.`), { status: 400 })
    }
    return { scoreWriteBack: null, employee: null }
  }

  const employeeBefore = await client.query(
    `SELECT id, full_name, performance_score, competency_score, learning_progress
     FROM employees WHERE id=$1 AND is_active=true FOR UPDATE`,
    [workflow.subject_employee_id],
  )
  const employee = employeeBefore.rows[0]
  if (!employee) throw Object.assign(new Error('Employee not found or inactive; workflow completion cannot update employee scores.'), { status: 404 })

  const previousValue = Number(employee[result.field] || 0)
  const updated = await client.query(
    `UPDATE employees SET ${result.field}=$1, updated_at=NOW()
     WHERE id=$2
     RETURNING id, employee_number, full_name, department, job_title, performance_score, competency_score, learning_progress, updated_at`,
    [result.newValue, workflow.subject_employee_id],
  )

  if (workflow.module === 'competency') {
    await upsertCompetencyAssessments(client, workflow.subject_employee_id, events, finalData, result.newValue)
  }

  if (workflow.module === 'learning') {
    await markLearningAssignmentsComplete(client, workflow.subject_employee_id)
    await applyGapLearningCompetencyLift(client, workflow, finalData)
  }

  return {
    employee: updated.rows[0],
    scoreWriteBack: {
      employeeId: workflow.subject_employee_id,
      workflowId: workflow.id,
      module: workflow.module,
      field: result.field,
      previousValue,
      newValue: result.newValue,
      source: result.source,
      calculation: result.calculation,
      actorId,
      completedAt: new Date().toISOString(),
    },
  }
}

async function resolveCompletedCourseGaps(client, employeeId) {
  // Find all learning assignments that reached 100% progress or status='completed'
  const completedAssignments = await client.query(
    `SELECT la.*, lr.title FROM learning_assignments la
     JOIN learning_resources lr ON lr.id = la.resource_id
     WHERE la.employee_id = $1 AND (la.status = 'completed' OR la.progress >= 100)`,
    [employeeId],
  )

  for (const asgn of completedAssignments.rows) {
    // 1. Record official completion in learning_completions if not already present
    await client.query(
      `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(created_by, $2) FROM workflows WHERE subject_employee_id=$2 ORDER BY created_at DESC LIMIT 1))
       ON CONFLICT (resource_id, employee_id) DO NOTHING`,
      [asgn.resource_id, employeeId, asgn.id, JSON.stringify({ autoVerified: true, progress: 100 })],
    )

    // 2. Lift linked competency scores so the gap is resolved!
    const linkedComps = await client.query(
      'SELECT competency FROM learning_resource_competencies WHERE resource_id=$1',
      [asgn.resource_id],
    )
    for (const { competency } of linkedComps.rows) {
      await client.query(
        `UPDATE competency_assessments
         SET score = LEAST(100, GREATEST(required_score, score + 18)),
             source = 'learning_completion',
             assessed_at = NOW(),
             updated_at = NOW()
         WHERE employee_id = $1 AND LOWER(competency) = LOWER($2)`,
        [employeeId, competency],
      )
    }
  }

  // 3. Mark active learning workflows matching completed courses as completed
  await client.query(
    `UPDATE workflows
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE module = 'learning' AND subject_employee_id = $1 AND status = 'active'
       AND metadata->>'courseTitle' IN (
         SELECT lr.title FROM learning_assignments la
         JOIN learning_resources lr ON lr.id = la.resource_id
         WHERE la.employee_id = $1 AND (la.status = 'completed' OR la.progress >= 100)
       )`,
    [employeeId],
  )
}

async function upsertCompetencyAssessments(client, employeeId, events, finalData, aggregateScore) {
  // 1. Extract defined competencies from define_requirements stage
  let rows = []
  for (const event of events || []) {
    if (event.stage === 'define_requirements') {
      const details = event.details || {}
      const list = Array.isArray(details.formData) ? details.formData : (Array.isArray(details) ? details : [])
      if (list.length > 0 && list.some(r => r?.competency)) {
        rows = list.filter(r => r?.competency)
      }
    }
  }

  if (!rows.length) {
    const forms = stageForms(events, finalData)
    const reqs = forms.define_requirements
    if (Array.isArray(reqs)) {
      rows = reqs.filter(r => r?.competency)
    } else if (reqs && typeof reqs === 'object') {
      rows = Object.values(reqs).filter(v => v && typeof v === 'object' && v.competency)
    }
  }

  // 2. Upsert each defined competency from the requirements definition
  for (const row of rows) {
    const competency = row?.competency
    if (!competency) continue
    const targetScore = clampScore(row.targetScore || row.target || row.required_score || row.requiredScore) || 80
    const actualScore = clampScore(row.actual || row.score || aggregateScore) || aggregateScore
    await client.query(
      `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
       VALUES ($1,$2,$3,$4,'assessment')
       ON CONFLICT (employee_id, competency)
       DO UPDATE SET score=EXCLUDED.score, required_score=EXCLUDED.required_score, source='assessment', assessed_at=NOW(), updated_at=NOW()`,
      [employeeId, competency, actualScore, targetScore],
    )
  }

  // 3. Extract prioritySkills from assign_plan and update their scores to the HR-approved evaluation score
  const prioritySkills = new Set()
  for (const event of events || []) {
    if (event.stage === 'assign_plan') {
      const details = event.details || {}
      const form = details.formData || details
      if (Array.isArray(form.prioritySkills)) {
        form.prioritySkills.forEach(s => { if (s) prioritySkills.add(s) })
      }
      if (form.competencyName) prioritySkills.add(form.competencyName)
    }
  }

  const targetScoreValue = Number(aggregateScore) || 85

  for (const skill of prioritySkills) {
    await client.query(
      `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
       VALUES ($1, $2, $3, 85, 'assessment')
       ON CONFLICT (employee_id, competency)
       DO UPDATE SET score = GREATEST(competency_assessments.score, EXCLUDED.score),
                     source = 'assessment',
                     assessed_at = NOW(),
                     updated_at = NOW()`,
      [employeeId, skill, targetScoreValue],
    )

    // Mark any gap-linked course assignments for this skill as completed
    const linkedAssignments = await client.query(
      `SELECT la.id, la.resource_id FROM learning_assignments la
       JOIN learning_resource_competencies lrc ON lrc.resource_id = la.resource_id
       WHERE la.employee_id = $1 AND LOWER(lrc.competency) = LOWER($2)`,
      [employeeId, skill],
    )
    for (const la of linkedAssignments.rows) {
      await client.query(
        `UPDATE learning_assignments SET progress=100, status='completed' WHERE id=$1`,
        [la.id],
      )
      await client.query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1, $2, $3, $4, (SELECT COALESCE(created_by, $2) FROM workflows WHERE subject_employee_id=$2 ORDER BY created_at DESC LIMIT 1))
         ON CONFLICT (resource_id, employee_id) DO UPDATE SET assessment_result=EXCLUDED.assessment_result, completed_at=NOW()`,
        [la.resource_id, employeeId, la.id, JSON.stringify({ autoVerified: true, progress: 100, source: 'competency_workflow_completion' })],
      )
    }
  }

  // 4. Resolve any completed courses and their linked competency gaps
  await resolveCompletedCourseGaps(client, employeeId)
}

async function markLearningAssignmentsComplete(client, employeeId) {
  await client.query(
    `UPDATE learning_assignments
     SET progress=100, status='completed'
     WHERE employee_id=$1 AND (progress < 100 OR status <> 'completed')`,
    [employeeId],
  )
  await resolveCompletedCourseGaps(client, employeeId)
}

async function applyGapLearningCompetencyLift(client, workflow, finalData) {
  const form = formFromDetails(finalData)
  if (!workflow.metadata?.assignedFromCompetencyGap && !form?.assignedFromCompetencyGap) return
  await client.query(
    'UPDATE employees SET competency_score = LEAST(100, competency_score + 10), updated_at = NOW() WHERE id = $1',
    [workflow.subject_employee_id],
  )
  const gapCompetency = workflow.metadata?.competencyName || form?.competencyName
  if (!gapCompetency) return
  await client.query(
    `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
     VALUES ($1, $2,
       LEAST(100, COALESCE((SELECT score FROM competency_assessments WHERE employee_id=$1 AND competency=$2), 60) + 10),
       COALESCE((SELECT required_score FROM competency_assessments WHERE employee_id=$1 AND competency=$2), 80),
       'learning_completion')
     ON CONFLICT (employee_id, competency)
     DO UPDATE SET score = LEAST(100, competency_assessments.score + 10),
                    source = 'learning_completion',
                    assessed_at = NOW(),
                    updated_at = NOW()`,
    [workflow.subject_employee_id, gapCompetency],
  )
}

// ---------------------------------------------------------------------------
// autoAssignGapLearning
// ---------------------------------------------------------------------------
// Called automatically when a competency or performance workflow completes.
// Detects all competency gaps (score < required_score) for the employee and:
//   1. Finds matching learning_resource by competency tag, or creates a placeholder
//   2. Creates a learning_assignment (skips if already assigned)
//   3. Creates a learning workflow (skips if an active one exists for this employee + resource)
//   4. Notifies the employee via the notifications table
//
// Runs INSIDE the caller's transaction so it atomically succeeds or rolls back
// together with the workflow completion.
//
// Returns: array of { competency, resourceId, resourceTitle, workflowId, isNew }
// ---------------------------------------------------------------------------
export async function autoAssignGapLearning(client, employeeId, actorId) {
  // 1. Fetch the employee
  const empRes = await client.query(
    'SELECT id, full_name FROM employees WHERE id=$1 AND is_active=true',
    [employeeId],
  )
  const emp = empRes.rows[0]
  if (!emp) return []

  // 2. Detect all current gaps
  const gapRes = await client.query(
    `SELECT competency, score, required_score,
            (required_score - score)::int AS gap
     FROM competency_assessments
     WHERE employee_id = $1 AND score < required_score
     ORDER BY (required_score - score) DESC`,
    [employeeId],
  )
  if (!gapRes.rows.length) return []

  // Determine a system-level actor ID — fall back to actorId (HR user)
  const systemActorId = actorId

  // Fetch initial learning stage key
  const stagesRes = await client.query(
    "SELECT 'self_study' AS initial_stage"  // placeholder; we'll read from workflow.js via stagesFor
  )
  // We can't import stagesFor here without circular deps, so we hard-code the
  // first learning stage key. This matches workflow.js stagesFor('learning')[0][0].
  const LEARNING_INITIAL_STAGE = 'self_study'

  const assigned = []

  for (const gap of gapRes.rows) {
    const { competency, gap: gapPoints } = gap

    // 3. Find matching resource (by competency tag) or create a placeholder
    const existingResource = await client.query(
      `SELECT r.* FROM learning_resources r
       JOIN learning_resource_competencies lrc ON lrc.resource_id = r.id
       WHERE r.is_active = true AND LOWER(lrc.competency) = LOWER($1)
       ORDER BY r.created_at DESC LIMIT 1`,
      [competency],
    )

    let resource = existingResource.rows[0]
    let isNewResource = false

    if (!resource) {
      // Create a labelled placeholder so HR can enrich it later
      const newRes = await client.query(
        `INSERT INTO learning_resources
           (title, description, category, provider, provider_type, duration_hours, created_by)
         VALUES ($1, $2, 'Skill Development', 'Company Training', 'internal', 4, $3)
         RETURNING *`,
        [
          `Development: ${competency}`,
          `Auto-assigned to address a detected skill gap in ${competency}. HR can add course content, video or PDF resources to this placeholder.`,
          systemActorId,
        ],
      )
      resource = newRes.rows[0]
      isNewResource = true

      // Tag the new resource with the competency
      await client.query(
        'INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [resource.id, competency],
      )
    }

    // 4. Create a learning_assignment if not already assigned
    await client.query(
      `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, status, progress)
       VALUES ($1, $2, $3, 'not_started', 0)
       ON CONFLICT (resource_id, employee_id) DO NOTHING`,
      [resource.id, employeeId, systemActorId],
    )

    // 5. Create a learning workflow if no active one exists for this employee + resource
    const activeWfCheck = await client.query(
      `SELECT id FROM workflows
       WHERE module='learning' AND subject_employee_id=$1 AND status='active'
         AND metadata->>'courseTitle' = $2
       LIMIT 1`,
      [employeeId, resource.title],
    )

    let workflowId = null
    if (!activeWfCheck.rows.length) {
      const metadata = {
        courseTitle: resource.title,
        assignedFromCompetencyGap: true,
        competencyName: competency,
        gapScore: gapPoints,
        assignedBy: systemActorId,
        autoAssigned: true,
      }
      const wfRes = await client.query(
        `INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, metadata)
         VALUES ('learning', $1, $2, $3, $4, $5) RETURNING *`,
        [
          `Learning Path: ${resource.title}`,
          employeeId,
          LEARNING_INITIAL_STAGE,
          systemActorId,
          metadata,
        ],
      )
      workflowId = wfRes.rows[0].id
      await client.query(
        `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details)
         VALUES ($1, $2, 'created', $3, $4, $5)`,
        [
          workflowId,
          LEARNING_INITIAL_STAGE,
          systemActorId,
          `Auto-assigned to address skill gap in ${competency} (gap: ${gapPoints} points)`,
          metadata,
        ],
      )
    } else {
      workflowId = activeWfCheck.rows[0].id
    }

    assigned.push({
      competency,
      resourceId: resource.id,
      resourceTitle: resource.title,
      workflowId,
      isNewResource,
    })
  }

  // 6. Notify the employee in-app (single bundled message)
  if (assigned.length > 0) {
    // Find the employee's user account
    const userRes = await client.query(
      'SELECT id FROM users WHERE employee_id=$1 AND is_active=true LIMIT 1',
      [employeeId],
    )
    const userId = userRes.rows[0]?.id
    if (userId) {
      const courseList = assigned.map(a => a.resourceTitle).join(', ')
      await client.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [
          userId,
          '🎓 New Learning Courses Assigned',
          `Based on your latest assessment, ${assigned.length} course(s) have been automatically assigned to address your skill gaps: ${courseList}. Visit My Learning to get started.`,
        ],
      )
    }
  }

  return assigned
}

export async function getCompetencyComparison(client, employeeId) {
  if (!employeeId) return null

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(employeeId))
  const empRes = await client.query(
    isUuid
      ? `SELECT id, full_name, job_title, department, performance_score, competency_score, learning_progress
         FROM employees WHERE (id::text = $1 OR employee_number = $1) AND is_active = true`
      : `SELECT id, full_name, job_title, department, performance_score, competency_score, learning_progress
         FROM employees WHERE employee_number = $1 AND is_active = true`,
    [employeeId]
  )
  const emp = empRes.rows[0]
  if (!emp) return null

  const realEmpId = emp.id

  const completedAssignments = await client.query(
    `SELECT la.*, lr.title, lr.category FROM learning_assignments la
     JOIN learning_resources lr ON lr.id = la.resource_id
     WHERE la.employee_id = $1 AND (la.status = 'completed' OR la.progress >= 100)`,
    [realEmpId]
  )

  const compAssessments = await client.query(
    `SELECT competency, score, required_score, source, assessed_at
     FROM competency_assessments WHERE employee_id = $1`,
    [realEmpId]
  )

  const baseCompetencyScore = Number(emp.competency_score) || 75
  const completedCount = completedAssignments.rows.length
  const autoLiftScore = Math.min(100, Math.max(baseCompetencyScore, baseCompetencyScore + (completedCount * 5)))
  const completedTitles = completedAssignments.rows.map(r => r.title)

  const kpiScore = Number(emp.performance_score) || 80
  const learningProg = Number(emp.learning_progress) || 80

  let aiScore = Math.round((autoLiftScore * 0.5) + (kpiScore * 0.3) + (learningProg * 0.2))
  let aiConfidenceBoost = 0
  if (kpiScore >= 85) aiConfidenceBoost += 3
  if (learningProg >= 85) aiConfidenceBoost += 2
  aiScore = Math.min(100, Math.max(autoLiftScore, aiScore + aiConfidenceBoost))

  const variance = aiScore - autoLiftScore

  let reasoning = ''
  if (variance > 0) {
    reasoning = `AI recommends a +${variance}% confidence boost (${aiScore}%) over auto-lift (${autoLiftScore}%) because ${emp.full_name} demonstrated strong performance KPI results (${kpiScore}%) and ${learningProg}% learning progress.`
  } else if (variance === 0) {
    reasoning = `AI recommendation matches the empirical auto-lift score (${autoLiftScore}%) based on verified course completions and alignment with role benchmarks.`
  } else {
    reasoning = `AI recommendation suggests ${aiScore}% based on balanced multi-metric evaluation across role competency benchmarks.`
  }

  return {
    employeeId,
    employeeName: emp.full_name,
    jobTitle: emp.job_title,
    department: emp.department,
    autoLift: {
      score: autoLiftScore,
      baseScore: baseCompetencyScore,
      completedCoursesCount: completedCount,
      completedCourses: completedTitles,
      assessmentsCount: compAssessments.rows.length
    },
    aiRecommended: {
      score: aiScore,
      kpiScore,
      learningProgress: learningProg,
      confidenceBoost: aiConfidenceBoost
    },
    variance,
    reasoning
  }
}


