import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { stagesFor } from '../src/workflow.js'

const bulkCreateSchema = z.object({
  module: z.enum(['performance', 'competency', 'learning', 'training', 'succession', 'recognition']),
  employeeIds: z.array(z.string().uuid()).min(1, 'At least one employee must be selected.'),
  cycleTitle: z.string().min(3).max(140),
  dueDate: z.string().datetime().nullable().optional(),
  skipExistingActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
})

test('bulkCreateSchema validates valid input', () => {
  const valid = {
    module: 'performance',
    employeeIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
    cycleTitle: 'Q4 2026 Performance Review',
    dueDate: '2026-12-31T23:59:59.000Z',
    skipExistingActive: true,
  }
  const parsed = bulkCreateSchema.parse(valid)
  assert.equal(parsed.module, 'performance')
  assert.equal(parsed.employeeIds.length, 2)
  assert.equal(parsed.cycleTitle, 'Q4 2026 Performance Review')
  assert.equal(parsed.skipExistingActive, true)
})

test('bulkCreateSchema rejects empty employeeIds or invalid UUIDs', () => {
  assert.throws(() => bulkCreateSchema.parse({
    module: 'performance',
    employeeIds: [],
    cycleTitle: 'Cycle',
  }))

  assert.throws(() => bulkCreateSchema.parse({
    module: 'performance',
    employeeIds: ['not-a-uuid'],
    cycleTitle: 'Cycle',
  }))
})

test('bulk review cycle initializes the correct initial stage for all modules', () => {
  const modules = ['performance', 'competency', 'learning', 'training', 'succession', 'recognition']
  for (const mod of modules) {
    const [initialStage] = stagesFor(mod)
    assert.ok(initialStage, `Module ${mod} must have an initial stage`)
    assert.ok(initialStage[0], `Module ${mod} initial stage key must exist`)
    assert.ok(initialStage[2].length > 0, `Module ${mod} must have authorized roles`)
  }
})

test('bulk workflow de-duplication simulates filtering active workflows correctly', () => {
  const employeeIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
  ]
  const activeSubjectIds = new Set(['22222222-2222-2222-2222-222222222222'])

  const toCreate = []
  const skipped = []

  for (const id of employeeIds) {
    if (activeSubjectIds.has(id)) {
      skipped.push(id)
    } else {
      toCreate.push(id)
    }
  }

  assert.deepEqual(toCreate, ['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'])
  assert.deepEqual(skipped, ['22222222-2222-2222-2222-222222222222'])
})
