import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveWorkflowScoreResult } from '../src/services/workflowCompletion.js'

test('Scenario 1: KPI achievement and weighted contribution calculation', () => {
  const events = [
    {
      stage: 'configure_kpi',
      details: {
        formData: [
          { name: 'Customer Satisfaction', target: '90', weight: 15, description: 'Customer satisfaction' },
          { name: 'Attendance', target: '95', weight: 35, description: 'Punctuality' },
          { name: 'Freight Handling Quality', target: '90', weight: 50, description: 'Quality standard' },
        ],
      },
    },
    {
      stage: 'self_assessment',
      details: {
        formData: {
          kpiRatings: [
            { name: 'Customer Satisfaction', target: '90', weight: 15, score: 90 },
            { name: 'Attendance', target: '95', weight: 35, score: 95 },
            { name: 'Freight Handling Quality', target: '90', weight: 50, score: 90 },
          ],
        },
      },
    },
    {
      stage: 'performance_evaluation',
      details: {
        formData: {
          kpiRatings: [
            { name: 'Customer Satisfaction', target: '90', weight: 15, score: 88 },
            { name: 'Attendance', target: '95', weight: 35, score: 95 },
            { name: 'Freight Handling Quality', target: '90', weight: 50, score: 90 },
          ],
        },
      },
    },
    {
      stage: 'calibration',
      details: {
        formData: {
          decision: 'Accept Department Head Score',
          finalScore: 99.67,
          employeeAvg: 100,
          deptAvg: 99.67,
        },
      },
    },
  ]

  const workflow = {
    id: '11111111-1111-1111-1111-111111111111',
    module: 'performance',
    subject_employee_id: '22222222-2222-2222-2222-222222222222',
  }

  const result = deriveWorkflowScoreResult(workflow, events, {}, null)
  assert.ok(result)
  assert.equal(result.field, 'performance_score')
  assert.equal(result.newValue, 99.67)
  assert.equal(result.source, 'calibration')
})

test('Scenario 2: Fallback to supervisor weighted score if calibration decision is accept supervisor', () => {
  const events = [
    {
      stage: 'performance_evaluation',
      details: {
        formData: {
          kpiRatings: [
            { name: 'Customer Satisfaction', target: 90, weight: 15, score: 88 }, // 88/90 * 15 = 14.67
            { name: 'Attendance', target: 100, weight: 85, score: 85 },        // 85/100 * 85 = 72.25
          ],
        },
      },
    },
  ]

  const workflow = {
    id: '11111111-1111-1111-1111-111111111111',
    module: 'performance',
    subject_employee_id: '22222222-2222-2222-2222-222222222222',
  }

  const result = deriveWorkflowScoreResult(workflow, events, {}, null)
  assert.ok(result)
  assert.equal(result.field, 'performance_score')
  // 14.67 + 72.25 = 86.92
  assert.equal(result.newValue, 86.92)
})

test('Scenario 3: Competency workflow score update from update_record stage', () => {
  const events = [
    {
      stage: 'update_record',
      details: {
        formData: {
          newScore: 82.5,
          reviewNotes: 'Assessed and updated competencies',
        },
      },
    },
  ]

  const workflow = {
    id: '33333333-3333-3333-3333-333333333333',
    module: 'competency',
    subject_employee_id: '22222222-2222-2222-2222-222222222222',
  }

  const result = deriveWorkflowScoreResult(workflow, events, {}, null)
  assert.ok(result)
  assert.equal(result.field, 'competency_score')
  assert.equal(result.newValue, 82.5)
  assert.equal(result.source, 'update_record')
})

test('Scenario 4: Learning workflow progress defaults to 100 on completed workflow', () => {
  const events = [
    {
      stage: 'assessment',
      details: {
        formData: {
          learningProgress: 100,
        },
      },
    },
  ]

  const workflow = {
    id: '44444444-4444-4444-4444-444444444444',
    module: 'learning',
    subject_employee_id: '22222222-2222-2222-2222-222222222222',
  }

  const result = deriveWorkflowScoreResult(workflow, events, {}, null)
  assert.ok(result)
  assert.equal(result.field, 'learning_progress')
  assert.equal(result.newValue, 100)
})
