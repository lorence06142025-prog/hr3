import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePerformance, calculateReadiness } from '../src/services/metrics.js'

test('calculatePerformance uses documented 50/30/20 weighting', () => {
  assert.equal(calculatePerformance({ kpi: 100, competency: 100, behavior: 100 }), 100)
  assert.equal(calculatePerformance({ kpi: 80, competency: 90, behavior: 70 }), 81)
  assert.equal(calculatePerformance({ kpi: 0, competency: 0, behavior: 0 }), 0)
})

test('calculatePerformance defaults missing inputs to zero', () => {
  assert.equal(calculatePerformance({}), 0)
  assert.equal(calculatePerformance({ kpi: 100 }), 50)
})

test('calculatePerformance rounds to nearest integer', () => {
  // 87*0.5 + 86*0.3 + 85*0.2 = 43.5 + 25.8 + 17 = 86.3 -> 86
  assert.equal(calculatePerformance({ kpi: 87, competency: 86, behavior: 85 }), 86)
})

test('calculateReadiness computes score with 50/30/20 weighting', () => {
  assert.deepEqual(calculateReadiness({ performance: 100, competency: 100, learning: 100 }), { score: 100, band: 'ready_now' })
  assert.deepEqual(calculateReadiness({ performance: 90, competency: 80, learning: 90 }), { score: 87, band: 'ready_now' })
})

test('calculateReadiness bands correctly at boundaries', () => {
  // 84 -> ready_in_1_2_years
  assert.equal(calculateReadiness({ performance: 84, competency: 84, learning: 84 }).band, 'ready_in_1_2_years')
  // 85 -> ready_now
  assert.equal(calculateReadiness({ performance: 85, competency: 85, learning: 85 }).band, 'ready_now')
  // 69 -> development_needed
  assert.equal(calculateReadiness({ performance: 69, competency: 69, learning: 69 }).band, 'development_needed')
  // 70 -> ready_in_1_2_years
  assert.equal(calculateReadiness({ performance: 70, competency: 70, learning: 70 }).band, 'ready_in_1_2_years')
})

test('calculateReadiness handles boundary band transitions', () => {
  // exactly 85 => ready_now
  assert.equal(calculateReadiness({ performance: 100, competency: 50, learning: 100 }).band, 'ready_now')
  // below 85 (79) => ready_in_1_2_years
  assert.equal(calculateReadiness({ performance: 100, competency: 50, learning: 70 }).band, 'ready_in_1_2_years')
})
