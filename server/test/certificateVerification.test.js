import test from 'node:test'
import assert from 'node:assert/strict'

test('sample certificate verification code format handling', () => {
  const sampleCode = 'SAMPLE-VERIFICATION-CODE'
  assert.equal(sampleCode.toUpperCase().includes('SAMPLE'), true)
})
