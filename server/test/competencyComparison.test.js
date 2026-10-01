import test from 'node:test'
import assert from 'node:assert/strict'
import { getCompetencyComparison } from '../src/services/workflowCompletion.js'

test('getCompetencyComparison computes auto-lift and AI recommendation with variance', async () => {
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('FROM employees')) {
        return {
          rows: [
            {
              id: params[0],
              full_name: 'Maria Lopez',
              job_title: 'Driver',
              department: 'Fleet & Transportation',
              performance_score: 90,
              competency_score: 75,
              learning_progress: 100,
            },
          ],
        }
      }
      if (sql.includes('FROM learning_assignments')) {
        return {
          rows: [
            { title: 'Defensive Driving & Hours-of-Service Compliance', category: 'Fleet Safety' },
            { title: 'Customer Service Excellence', category: 'Customer Service' },
          ],
        }
      }
      if (sql.includes('FROM competency_assessments')) {
        return {
          rows: [
            { competency: 'Customer Service', score: 85, required_score: 85 },
          ],
        }
      }
      return { rows: [] }
    },
  }

  const result = await getCompetencyComparison(mockClient, 'e0000000-0000-0000-0000-000000000001')

  assert.ok(result)
  assert.equal(result.employeeName, 'Maria Lopez')
  assert.equal(result.autoLift.baseScore, 75)
  assert.equal(result.autoLift.completedCoursesCount, 2)
  assert.equal(result.autoLift.score, 85) // 75 + (2 * 5) = 85
  assert.ok(result.aiRecommended.score >= 85)
  assert.ok(result.reasoning.includes('AI recommends'))
})

test('getCompetencyComparison returns null when employee is not found', async () => {
  const mockClient = { query: async () => ({ rows: [] }) }
  const result = await getCompetencyComparison(mockClient, 'non-existent')
  assert.equal(result, null)
})
