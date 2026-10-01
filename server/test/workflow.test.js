import test from 'node:test'
import assert from 'node:assert/strict'
import { nextStage, stagesFor, returnToStage, previousStages, canActOnStage } from '../src/workflow.js'
import { calculatePerformance, calculateReadiness } from '../src/services/metrics.js'
import { deriveWorkflowScoreResult } from '../src/services/workflowCompletion.js'
import { resolveNextOwners } from '../src/routes/workflows.js'

test('performance workflow advances only in its defined order', () => {
  assert.deepEqual(nextStage('performance', 'self_assessment', 'employee'), { key: 'performance_evaluation', label: 'Performance evaluation', roles: ['supervisor'] })
  assert.throws(() => nextStage('performance', 'self_assessment', 'supervisor'), { status: 403 })
})

test('the workflow subject may complete employee-assigned stages regardless of role', () => {
  const subjectId = '11111111-1111-1111-1111-111111111111'
  // A supervisor who is the subject may complete their own self-assessment.
  assert.deepEqual(
    nextStage('performance', 'self_assessment', 'supervisor', subjectId, subjectId),
    { key: 'performance_evaluation', label: 'Performance evaluation', roles: ['supervisor'] },
  )
  // A supervisor who is NOT the subject still cannot complete it.
  assert.throws(
    () => nextStage('performance', 'self_assessment', 'supervisor', subjectId, '22222222-2222-2222-2222-222222222222'),
    { status: 403 },
  )
  // A supervisor who is not the subject cannot complete it via canActOnStage either.
  assert.equal(canActOnStage(['employee'], 'supervisor', subjectId, undefined), false)
  assert.equal(canActOnStage(['employee'], 'employee', subjectId, subjectId), true)
})

test('only HR may complete the published performance stage', () => {
  assert.equal(nextStage('performance', 'published', 'hr'), null)
  assert.throws(() => nextStage('performance', 'published', 'employee'), { status: 403 })
})

test('every module has a valid actionable workflow', () => {
  const expectedModules = ['performance', 'competency', 'learning', 'training', 'succession', 'recognition']

  for (const module of expectedModules) {
    const stages = stagesFor(module)
    const [firstKey, , firstRoles] = stages[0]
    const [lastKey, , lastRoles] = stages.at(-1)

    assert.ok(firstRoles.length, `${module} should have a role that can start it`)
    assert.ok(lastRoles.length, `${module} should have a role that can finish it`)
    assert.doesNotThrow(() => nextStage(module, firstKey, firstRoles[0]))
    assert.equal(nextStage(module, lastKey, lastRoles[0]), null)
  }
})

test('returnToStage moves a workflow to an earlier stage for the current owner', () => {
  assert.deepEqual(returnToStage('performance', 'performance_evaluation', 'supervisor'), { key: 'self_assessment', label: 'Self assessment', roles: ['employee'] })
  assert.deepEqual(returnToStage('performance', 'performance_evaluation', 'supervisor', 'self_assessment'), { key: 'self_assessment', label: 'Self assessment', roles: ['employee'] })
})

test('returnToStage rejects invalid targets and non-owners', () => {
  assert.throws(() => returnToStage('performance', 'self_assessment', 'supervisor'), { status: 403 })
  assert.throws(() => returnToStage('performance', 'create_review', 'hr'), { status: 409 })
  assert.throws(() => returnToStage('performance', 'calibration', 'hr', 'final_approval'), { status: 400 })
  assert.throws(() => returnToStage('performance', 'calibration', 'hr', 'does_not_exist'), { status: 400 })
})

test('previousStages returns only stages before the current one', () => {
  const stages = previousStages('performance', 'calibration', 'hr')
  assert.deepEqual(stages.map(({ key }) => key), ['create_review', 'self_assessment', 'performance_evaluation'])
  assert.throws(() => previousStages('performance', 'self_assessment', 'supervisor'), { status: 403 })
})

test('scores use stable documented weightings', () => {
  assert.equal(calculatePerformance({ kpi: 80, competency: 90, behavior: 70 }), 81)
  assert.deepEqual(calculateReadiness({ performance: 90, competency: 80, learning: 90 }), { score: 87, band: 'ready_now' })
})

test('performance completion uses calibrated final score before self assessment', () => {
  const workflow = { id: 'wf-1', module: 'performance', subject_employee_id: 'emp-1' }
  const result = deriveWorkflowScoreResult(workflow, [
    { stage: 'self_assessment', details: { formData: { overall: 72 } } },
    { stage: 'performance_evaluation', details: { formData: { overall: 80 } } },
    { stage: 'calibration', details: { formData: { decision: 'Override Final Score', finalScore: 85, employeeAvg: 72, deptAvg: 80 } } },
  ])
  assert.equal(result.field, 'performance_score')
  assert.equal(result.newValue, 85)
  assert.equal(result.source, 'calibration')
})

test('performance assessment fallback uses weighted KPI average', () => {
  const workflow = { id: 'wf-weighted', module: 'performance', subject_employee_id: 'emp-1' }
  const result = deriveWorkflowScoreResult(workflow, [
    {
      stage: 'performance_evaluation',
      details: {
        formData: {
          overall: 50,
          kpiRatings: [
            { name: 'Customer Satisfaction', score: 100, weight: 80 },
            { name: 'Attendance', score: 0, weight: 20 },
          ],
        },
      },
    },
  ])
  assert.equal(result.field, 'performance_score')
  assert.equal(result.newValue, 80)
  assert.equal(result.source, 'performance_evaluation')
})

test('competency completion uses update record score', () => {
  const workflow = { id: 'wf-2', module: 'competency', subject_employee_id: 'emp-1' }
  const result = deriveWorkflowScoreResult(workflow, [
    { stage: 'track_progress', details: { formData: [{ name: 'Plan', progress: 60 }] } },
    { stage: 'update_record', details: { formData: { newScore: 80, reviewNotes: 'Updated after assessment.' } } },
  ])
  assert.equal(result.field, 'competency_score')
  assert.equal(result.newValue, 80)
  assert.equal(result.source, 'update_record')
})

test('learning completion uses tracked progress or defaults to complete', () => {
  const workflow = { id: 'wf-3', module: 'learning', subject_employee_id: 'emp-1' }
  const tracked = deriveWorkflowScoreResult(workflow, [
    { stage: 'assessment', details: { formData: [{ name: 'Course', progress: 90 }, { name: 'Practice', progress: 100 }] } },
  ])
  assert.equal(tracked.field, 'learning_progress')
  assert.equal(tracked.newValue, 95)
  assert.equal(tracked.source, 'assessment')

  const completed = deriveWorkflowScoreResult(workflow, [])
  assert.equal(completed.newValue, 100)
  assert.equal(completed.source, 'workflow_completed_default')
})

test('canActOnStage prevents other employees from acting on multi-role stages containing employee', () => {
  const subjectId = 'yuan-uuid-1'
  const otherEmployeeId = 'hexa-uuid-2'
  const multiRoles = ['employee', 'supervisor']

  // The subject employee can act
  assert.equal(canActOnStage(multiRoles, 'employee', subjectId, subjectId), true)
  // Another employee CANNOT act on this employee's stage
  assert.equal(canActOnStage(multiRoles, 'employee', subjectId, otherEmployeeId), false)
  // A supervisor can act
  assert.equal(canActOnStage(multiRoles, 'supervisor', subjectId, 'supervisor-uuid'), true)
})

test('resolveNextOwners scopes notifications to subject employee and department supervisor only', async () => {
  const mockClient = {
    async query(sql, params) {
      if (sql.includes('FROM employees WHERE id = $1')) {
        return {
          rows: [
            { id: 'emp-yuan', full_name: 'Yuan Amboy', department: 'Sales & Marketing', manager_id: 'emp-elena' },
          ],
        }
      }
      if (sql.includes('FROM users WHERE employee_id = $1') && params[0] === 'emp-yuan') {
        return {
          rows: [
            { id: 'user-yuan', email: 'yuan.amby@gmail.com', full_name: 'Yuan Amboy' },
          ],
        }
      }
      if (sql.includes('FROM users WHERE employee_id = $1') && params[0] === 'emp-elena') {
        return {
          rows: [
            { id: 'user-elena', email: 'elena@pds.local', full_name: 'Elena Rostova' },
          ],
        }
      }
      if (sql.includes("e.department = $1 AND u.is_active = true")) {
        return {
          rows: [
            { id: 'user-elena', email: 'elena@pds.local', full_name: 'Elena Rostova' },
          ],
        }
      }
      if (sql.includes("role = 'supervisor'")) {
        // Broad supervisor query should NOT be hit when department supervisor exists
        return {
          rows: [
            { id: 'user-jordan', email: 'jordan@pds.local', full_name: 'Jordan Williams' },
          ],
        }
      }
      return { rows: [] }
    },
  }

  const workflow = {
    id: 'wf-test-1',
    module: 'competency',
    title: 'Skill development: Yuan Amboy',
    subject_employee_id: 'emp-yuan',
  }
  const destination = {
    key: 'track_progress',
    label: 'Track learning progress',
    roles: ['employee', 'supervisor'],
  }

  const recipients = await resolveNextOwners(mockClient, workflow, destination)

  // Verify only Yuan and Elena are recipients
  const emails = recipients.map(r => r.email)
  assert.equal(recipients.length, 2)
  assert.ok(emails.includes('yuan.amby@gmail.com'), 'Subject employee must be notified')
  assert.ok(emails.includes('elena@pds.local'), 'Department supervisor must be notified')
  assert.ok(!emails.includes('hexaanonuevo31@gmail.com'), 'Other employees must NOT be notified')
  assert.ok(!emails.includes('jannahmaenueva01@gmail.com'), 'Other employees must NOT be notified')
  assert.ok(!emails.includes('eymardbuyser09@gmail.com'), 'Other employees must NOT be notified')
  assert.ok(!emails.includes('jordan@pds.local'), 'Supervisors from other departments must NOT be notified')
})

