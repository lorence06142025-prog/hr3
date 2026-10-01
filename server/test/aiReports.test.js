import test from 'node:test'
import assert from 'node:assert/strict'
import { generateAI } from '../src/services/aiReports.js'

test('ai report generation produces structured module sections', async () => {
  const report = await generateAI('performance', { employee_count: 10, average_score: 74, active_count: 3, completed_count: 7 }, { top_name: 'Emily Thompson', top_score: 92, bottom_name: 'Jordan Williams', bottom_score: 55 })
  assert.ok(report.title.includes('Performance'))
  assert.ok(Array.isArray(report.sections))
  assert.ok(report.sections.length >= 7, 'performance report should have all required sections')
  const headings = report.sections.map(s => s.heading)
  for (const required of ['Overall Performance Summary', 'KPI Analysis', 'Strengths', 'Areas Needing Improvement', 'Coaching Recommendations', 'Performance Trend', 'Readiness Score']) {
    assert.ok(headings.includes(required), `missing section: ${required}`)
  }
  assert.ok(report.content.includes('## KPI Analysis'))
})

test('ai report generation produces the concise 6-section executive report', async () => {
  const metrics = {
    workforce: { employee_count: 50, average_performance: 78, average_competency: 74, learning_completion: 82 },
    departments: [{ department: 'Front Office', employees: 20, performance: 80, competency: 75, learning: 85 }],
    activeWorkflows: [{ module: 'performance', current_stage: 'calibration', count: 5 }],
    succession: { ready_now_count: 8, ready_later_count: 12, development_count: 6 },
    recognition: { completed_count: 44, active_count: 6 },
    training: { completed_count: 30, active_count: 4 },
  }
  const report = await generateAI('executive', metrics)
  const headings = report.sections.map(s => s.heading)
  const required = ['Workforce Overview', 'Department Performance & Competency Analysis', 'Learning & Training Effectiveness', 'Succession & Recognition Analysis', 'Organizational Strengths', 'Priority Actions & Executive Recommendations']
  for (const heading of required) {
    assert.ok(headings.includes(heading), `missing executive section: ${heading}`)
  }
  assert.equal(report.title, 'Executive Workforce Analytics Report')

  // The executive report should be concise: the 6 content sections plus the
  // two data-transparency sections (Data Completeness & Confidence, Datasets Analyzed).
  const contentSections = report.sections.filter(s => !/datasets|confidence/i.test(s.heading))
  assert.equal(contentSections.length, 6, 'executive report should have exactly 6 content sections')
  // Recommendations must be capped at 5 bullets.
  const recommendations = contentSections.find(s => /recommend/i.test(s.heading)).body
  const recBullets = recommendations.split('\n').filter(l => l.trim().startsWith('-')).length
  assert.ok(recBullets <= 5, `recommendations should be at most 5 bullets, got ${recBullets}`)
})

test('ai report falls back to structured summary when LLM is unavailable', async () => {
  // Even with no OpenRouter key / template path, the structured summary is returned.
  const report = await generateAI('competency', { employee_count: 5, average_score: 70, active_count: 2, completed_count: 3 })
  assert.ok(report.sections.length >= 6)
  const headings = report.sections.map(s => s.heading)
  for (const required of ['Competency Summary', 'Missing Competencies', 'Skill Gap Analysis', 'Priority Skills', 'Development Recommendations', 'Readiness Assessment']) {
    assert.ok(headings.includes(required), `missing section: ${required}`)
  }
})
