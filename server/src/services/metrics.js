export function calculateReadiness({ performance = 0, competency = 0, learning = 0 }) {
  const score = Math.round(performance * 0.5 + competency * 0.3 + learning * 0.2)
  return { score, band: score >= 85 ? 'ready_now' : score >= 70 ? 'ready_in_1_2_years' : 'development_needed' }
}

export function calculatePerformance({ kpi = 0, competency = 0, behavior = 0 }) {
  return Math.round(kpi * 0.5 + competency * 0.3 + behavior * 0.2)
}
