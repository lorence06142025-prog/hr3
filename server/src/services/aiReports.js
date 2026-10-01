import { query, transaction } from '../db.js'
import { config } from '../config.js'
import { generateInsights } from './openrouter.js'

// ---------------------------------------------------------------------------
// AI report orchestration.
//
// Each function is deliberately separated so it can be reused independently:
//   - calculateMetrics()  computes the module / executive metrics from the DB
//   - buildSummary()      builds a deterministic summary from those metrics
//   - generateAI()        calls the LLM (falls back to buildSummary on failure)
//   - saveReport()        persists the report + links it to the workflow audit
//
// AI generation is non-blocking best-effort: a failure never prevents a
// workflow from completing. Metrics are always saved so a report can be
// generated (or regenerated) later.
// ---------------------------------------------------------------------------

const n = value => Math.round(Number(value || 0))

// ------------------------- Metric queries by module -------------------------

const MODULE_METRIC_QUERIES = {
  performance: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(performance_score))::int,0) AS average_score,
    (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='active') AS active_count,
    (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='completed') AS completed_count
    FROM employees WHERE is_active=true`,
  competency: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(competency_score))::int,0) AS average_score,
    (SELECT count(*)::int FROM workflows WHERE module='competency' AND status='active') AS active_count,
    (SELECT count(*)::int FROM workflows WHERE module='competency' AND status='completed') AS completed_count
    FROM employees WHERE is_active=true`,
learning: `SELECT
    (SELECT count(*)::int FROM learning_resources WHERE is_active=true) AS resource_count,
    (SELECT count(*)::int FROM learning_assignments) AS assigned_count,
    (SELECT count(*)::int FROM learning_completions) AS completed_count,
    (SELECT count(*)::int FROM learning_assignments WHERE status='in_progress') AS active_count,
    (SELECT coalesce(round(avg(la.progress))::int,0) AS p FROM learning_assignments la) AS average_score`,
  training: `SELECT 
    (SELECT count(*)::int FROM training_sessions WHERE status='scheduled' OR status='ongoing') AS active_count,
    (SELECT count(*)::int FROM training_sessions WHERE status='completed') AS completed_count,
    (SELECT count(*)::int FROM training_participants) AS participant_count,
    (SELECT coalesce(round(avg(CASE WHEN attendance='present' OR attendance='late' THEN 100 ELSE 0 END))::int, 0) FROM training_participants WHERE attendance != 'pending') AS average_score`,
  succession: `SELECT count(*)::int AS candidate_count,
    coalesce(round(avg(readiness_score))::int,0) AS average_readiness,
    count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count,
    count(*) FILTER (WHERE readiness_band='ready_in_1_2_years')::int AS ready_later_count,
    count(*) FILTER (WHERE readiness_band='development_needed')::int AS development_count
    FROM succession_profiles`,
  recognition: `SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count,
    (SELECT count(*)::int FROM workflows WHERE module='recognition' AND status='active') AS active_count
    FROM workflows WHERE module='recognition'`,
}

// Employee-scoped metric queries — used when the report is generated for a
// specific employee (e.g. an employee generating their OWN AI insight for a
// completed workflow). These return the individual's personal metrics and
// their own module activity, NOT the org-wide averages.
const EMPLOYEE_METRIC_QUERIES = {
  performance: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    (SELECT count(*)::int FROM workflows w WHERE w.module='performance' AND w.subject_employee_id=e.id AND w.status='completed') AS completed_count,
    (SELECT count(*)::int FROM workflows w WHERE w.module='performance' AND w.subject_employee_id=e.id AND w.status='active') AS active_count
    FROM employees e WHERE e.id=$1 AND e.is_active=true`,
  competency: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    (SELECT count(*)::int FROM workflows w WHERE w.module='competency' AND w.subject_employee_id=e.id AND w.status='completed') AS completed_count,
    (SELECT count(*)::int FROM workflows w WHERE w.module='competency' AND w.subject_employee_id=e.id AND w.status='active') AS active_count
    FROM employees e WHERE e.id=$1 AND e.is_active=true`,
  learning: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    (CASE WHEN e.learning_progress >= 100 THEN 1 ELSE 0 END)::int AS completed_count,
    (SELECT count(*)::int FROM workflows w WHERE w.module='learning' AND w.subject_employee_id=e.id AND w.status='active') AS active_count
    FROM employees e WHERE e.id=$1 AND e.is_active=true`,
  training: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    (SELECT count(*)::int FROM training_participants tp JOIN training_sessions ts ON tp.session_id=ts.id WHERE tp.employee_id=e.id AND ts.status='completed') AS completed_count,
    (SELECT count(*)::int FROM training_participants tp JOIN training_sessions ts ON tp.session_id=ts.id WHERE tp.employee_id=e.id AND (ts.status='scheduled' OR ts.status='ongoing')) AS active_count
    FROM employees e WHERE e.id=$1 AND e.is_active=true`,
  succession: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    coalesce(s.readiness_score,0)::int AS readiness_score,
    coalesce(s.readiness_band,'none') AS readiness_band
    FROM employees e LEFT JOIN succession_profiles s ON s.employee_id=e.id WHERE e.id=$1 AND e.is_active=true`,
  recognition: `SELECT e.full_name AS employee_name, e.department, e.job_title,
    coalesce(e.performance_score,0)::int AS performance_score,
    coalesce(e.competency_score,0)::int AS competency_score,
    coalesce(e.learning_progress,0)::int AS learning_progress,
    (SELECT count(*)::int FROM workflows w WHERE w.module='recognition' AND w.subject_employee_id=e.id AND w.status='completed') AS completed_count,
    (SELECT count(*)::int FROM workflows w WHERE w.module='recognition' AND w.subject_employee_id=e.id AND w.status='active') AS active_count
    FROM employees e WHERE e.id=$1 AND e.is_active=true`,
}

const EXECUTIVE_METRIC_QUERIES = {
  workforce: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(performance_score))::int,0) AS average_performance,
    coalesce(round(avg(competency_score))::int,0) AS average_competency,
    coalesce(round(avg(learning_progress))::int,0) AS learning_completion
    FROM employees WHERE is_active=true`,
  departments: `SELECT department, count(*)::int AS employees,
    coalesce(round(avg(performance_score))::int,0) AS performance,
    coalesce(round(avg(competency_score))::int,0) AS competency,
    coalesce(round(avg(learning_progress))::int,0) AS learning
    FROM employees WHERE is_active=true GROUP BY department ORDER BY department`,
  workflows: `SELECT module, current_stage, count(*)::int AS count
    FROM workflows WHERE status='active' GROUP BY module, current_stage ORDER BY module`,
  succession: `SELECT count(*)::int AS candidate_count,
    count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count,
    count(*) FILTER (WHERE readiness_band='ready_in_1_2_years')::int AS ready_later_count,
    count(*) FILTER (WHERE readiness_band='development_needed')::int AS development_count
    FROM succession_profiles`,
  recognition: `SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count,
    count(*) FILTER (WHERE status='active')::int AS active_count
    FROM workflows WHERE module='recognition'`,
  training: `SELECT 
    count(*) FILTER (WHERE status='completed')::int AS completed_count,
    count(*) FILTER (WHERE LOWER(status)='scheduled' OR LOWER(status)='ongoing')::int AS active_count,
    (SELECT count(*)::int FROM training_participants) AS participant_count,
    (SELECT count(*) FILTER (WHERE LOWER(attendance)='present' OR LOWER(attendance)='late')::int FROM training_participants) AS present_count
    FROM training_sessions`,
}

// ---------------------------- Metric calculation ----------------------------

const pct = value => `${n(value)}%`

// --------------------- Data context / completeness -------------------------

// Which datasets each module report is based on, and the metric key that holds
// its record count. Used to compute the confidence indicator and to state
// explicitly which datasets were analyzed (and which have no records yet).
const MODULE_DATA_CONTEXT = {
  performance: [
    ['Employee performance records', 'employee_count'],
    ['Completed performance reviews', 'completed_count'],
    ['Active performance reviews', 'active_count'],
  ],
  competency: [
    ['Employee competency records', 'employee_count'],
    ['Active development workflows', 'active_count'],
  ],
learning: [
    ['Learning resources in library', 'resource_count'],
    ['Course assignments', 'assigned_count'],
    ['Confirmed completions', 'completed_count'],
    ['Active / in-progress assignments', 'active_count'],
  ],
  training: [
    ['Completed training workflows', 'completed_count'],
    ['Active training workflows', 'active_count'],
  ],
  succession: [
    ['Succession profiles', 'candidate_count'],
  ],
  recognition: [
    ['Completed recognition records', 'completed_count'],
    ['Active recognition workflows', 'active_count'],
  ],
}

function computeDataContext(module, metrics) {
  const datasets = []
  const missing = []
  let covered = 0
  let total = 0

  const add = (label, count) => {
    const c = Number(count || 0)
    datasets.push({ label, count: c })
    total++
    if (c > 0) covered++
    else missing.push(label)
  }

  if (module === 'executive') {
    add('Employee records', metrics.workforce?.employee_count)
    add('Departments analyzed', metrics.departments?.length)
    add('Active workflows', (metrics.activeWorkflows || []).reduce((s, r) => s + Number(r.count || 0), 0))
    add('Succession profiles', metrics.succession?.candidate_count)
    add('Completed recognition records', metrics.recognition?.completed_count)
    add('Completed training workflows', metrics.training?.completed_count)
  } else {
    for (const [label, key] of (MODULE_DATA_CONTEXT[module] || [])) {
      add(label, metrics[key])
    }
  }

  const confidence = total === 0 ? 0 : Math.round((covered / total) * 100)
  const completeness = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'
  return { datasets, missing, confidence, completeness }
}

function datasetsSection(dataContext) {
  const body = dataContext.datasets.length
    ? dataContext.datasets.map(d => `- **${d.label}**: ${n(d.count)} record(s)${d.count === 0 ? ' — no records yet' : ''}`).join('\n')
    : 'No datasets were available for analysis.'
  return { heading: 'Datasets Analyzed', body }
}

function dataCompletenessSection(dataContext) {
  const populated = dataContext.datasets.filter(d => d.count > 0).length
  const total = dataContext.datasets.length
  const missingText = dataContext.missing.length
    ? `The following dataset(s) currently have no records: **${dataContext.missing.join(', ')}**. ${total === 1 ? 'This section is based on no confirmed data.' : 'Recommendations are grounded only in the populated datasets.'}`
    : 'All analyzed datasets contain records, so the findings below are based on confirmed data.'
  const body = `This report is based on **${populated} of ${total}** analyzed dataset(s). Confidence in the findings is **${dataContext.completeness}** (${dataContext.confidence}%). ${missingText}`
  return { heading: 'Data Completeness & Confidence', body }
}

function buildPerformanceSections(metrics, details = {}) {
  const sections = []
  const avg = pct(metrics.average_score)
  const completed = n(metrics.completed_count || 0)
  const active = n(metrics.active_count || 0)
  const employees = n(metrics.employee_count || 0)
  sections.push({ heading: 'Overall Performance Summary', body: `The performance review population includes **${employees}** active employee records with an average performance score of **${avg}**. There are **${completed}** completed reviews and **${active}** active review workflows. This means review coverage is ${active > 0 ? 'still in progress' : 'fully documented'}, and the average score reflects ${employees > 0 ? 'the whole recorded population' : 'no confirmed records yet'}.` })
  sections.push({ heading: 'KPI Analysis', body: `KPI delivery is reflected in the average score of **${avg}**. ${details.top_name ? `The spread between the highest (**${pct(details.top_score)||0}** — ${details.top_name}) and lowest (**${pct(details.bottom_score)||0}** — ${details.bottom_name}) performers indicates where recognition and coaching effort should be concentrated.` : 'Insufficient records exist to compare high and low performers; no KPI delivery gap can be assessed yet.'}` })
  sections.push({ heading: 'Strengths', body: `Completed reviews (**${completed}**) show that evaluation activity has reached a documented conclusion, providing a stable evidence base for development and recognition decisions. ${completed > 0 ? 'A higher completion count relative to active reviews signals disciplined review execution.' : 'No completed reviews are recorded, so strengths cannot yet be confirmed from performance evidence.'}` })
  sections.push({ heading: 'Areas Needing Improvement', body: `Active review workflows (**${active}**) represent outstanding evaluation activity. ${details.bottom_name ? `The gap between top and bottom performers (${pct(details.top_score)||0} vs ${pct(details.bottom_score)||0}) highlights roles that may benefit from targeted coaching after validating role context and manager feedback.` : 'Insufficient records exist to identify specific individuals; the priority is to close open review cycles first.'}` })
  sections.push({ heading: 'Coaching Recommendations', body: `Coaching should target the lowest-scoring band and priority should be proportional to the gap from the workforce average (**${avg}**). Recommendations are derived from the calculated metrics, so focus coaching where the score gap is widest.` })
  sections.push({ heading: 'Performance Trend', body: `The average score (**${avg}**) paired with **${completed}** completed reviews forms the current trend baseline. ${completed < 2 ? 'Additional completed cycles are required to establish a meaningful multi-period trend.' : 'Repeated cycles provide a basis for comparing performance movement over time.'}` })
  sections.push({ heading: 'Readiness Score', body: `Readiness is derived from performance, competency, and learning metrics. The average performance score (**${avg}**) is the single largest contributor to readiness; higher performance correlates with greater readiness for expanded responsibility.` })
  return sections
}

function buildCompetencySections(metrics, details = {}) {
  const sections = []
  const avg = pct(metrics.average_score)
  const employees = n(metrics.employee_count || 0)
  const active = n(metrics.active_count || 0)
  sections.push({ heading: 'Competency Summary', body: `**${employees}** active employee records have an average competency score of **${avg}**. The gap between this average and full proficiency (**100%**) represents the current capability headroom across the workforce.` })
  sections.push({ heading: 'Missing Competencies', body: `With an average of **${avg}**, the workforce is operating below full competency. The shortfall (**${100 - n(metrics.average_score)}** points) indicates competencies that are missing or under-developed and should be the focus of the development plan.` })
  sections.push({ heading: 'Skill Gap Analysis', body: `**${active}** active development workflows show capability records still under review. The relationship between the average score (**${avg}**) and the number of open development workflows reveals whether skill gaps are being actively addressed or left unmanaged.` })
  sections.push({ heading: 'Priority Skills', body: `Prioritize skills tied to the lowest competency scores. The larger the gap from the average (**${avg}**), the higher the priority for a given competency area in the development plan.` })
  sections.push({ heading: 'Development Recommendations', body: `Assign development plans to close the gap between current scores (**${avg}**) and full proficiency. Focus development activity on the **${active}** active workflows to ensure capability building is actively managed.` })
  sections.push({ heading: 'Readiness Assessment', body: `Ready-now readiness increases as competency scores approach full proficiency. The current average (**${avg}**) informs the readiness band: a higher score supports faster succession and delegation readiness.` })
  return sections
}

function buildLearningSections(metrics) {
  const sections = []
  const resources = n(metrics.resource_count || 0)
  const assigned = n(metrics.assigned_count || 0)
  const completed = n(metrics.completed_count || 0)
  const active = n(metrics.active_count || 0)
  const avg = pct(metrics.average_score)
  const progressable = assigned + active
  const rate = progressable > 0 ? Math.round((completed / (assigned + completed)) * 100) : 0
  sections.push({ heading: 'Course Library', body: `The learning library holds **${resources}** active course resource(s). **${assigned}** course assignment(s) have been made to employees, of which **${completed}** have a confirmed completion record.` })
  sections.push({ heading: 'Completion Analysis', body: `Of the assigned courses, **${completed}** record(s) have a confirmed completion in the database. The confirmed completion rate is **${rate}%**. No employee is reported as completing a course without a corresponding completion record.` })
  sections.push({ heading: 'Learning Engagement', body: `Average progress across assignments is **${avg}**, with **${active}** assignment(s) currently in progress. The gap between average progress and full completion shows how much learning activity remains.` })
  sections.push({ heading: 'Learning Effectiveness', body: `Completed records (**${completed}**) demonstrate that learning activities can reach completion, supporting the effectiveness of assigned learning paths. Higher completion generally correlates with more effective learning design.` })
  sections.push({ heading: 'Suggested Next Courses', body: `Recommend next courses based on the gap between current progress (**${avg}**) and the completion target. Learners furthest from completion should be prioritized for the next relevant course in their path.` })
  return sections
}

function buildTrainingSections(metrics) {
  const sections = []
  const active = n(metrics.active_count || 0)
  const completed = n(metrics.completed_count || 0)
  const total = active + completed
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  sections.push({ heading: 'Attendance Analysis', body: `Training activity includes **${active}** active and **${completed}** completed training workflows. Attendance execution is ${active > 0 ? 'still ongoing for some sessions' : 'complete for all recorded sessions'}.` })
  sections.push({ heading: 'Completion Rate', body: `The completion rate is **${rate}%** (**${completed}** of **${total}** training workflows). ${total > 0 ? 'This reflects how much of the training pipeline has reached its documented endpoint.' : 'No training workflows are recorded, so a completion rate cannot yet be computed.'}` })
  sections.push({ heading: 'Training Effectiveness', body: `Completed training workflows (**${completed}**) represent training that reached its documented endpoint. A higher completion rate (**${rate}%**) indicates more effective training delivery and participant follow-through.` })
  sections.push({ heading: 'Participants Needing Follow-up', body: `Active training workflows (**${active}**) identify participants or sessions requiring follow-up to reach completion. These should be prioritized to improve the overall completion rate.` })
  sections.push({ heading: 'Recommended Future Trainings', body: `Recommend future training based on recorded completion (**${completed}**) and outstanding active sessions (**${active}**), prioritizing areas with incomplete delivery to raise the completion rate.` })
  return sections
}

function buildSuccessionSections(metrics) {
  const sections = []
  const candidates = n(metrics.candidate_count || 0)
  const avg = pct(metrics.average_readiness)
  const readyNow = n(metrics.ready_now_count || 0)
  const readyLater = n(metrics.ready_later_count || 0)
  const development = n(metrics.development_count || 0)
  sections.push({ heading: 'Readiness Summary', body: `**${candidates}** succession profile(s) have an average readiness score of **${avg}**. The distribution (${readyNow} Ready Now, ${readyLater} Ready in 1–2 years, ${development} Development Needed) shows the depth of the current leadership pipeline.` })
  sections.push({ heading: 'Leadership Potential', body: `**${readyNow}** profile(s) are Ready Now and **${readyLater}** are Ready in 1–2 years. A higher Ready Now share indicates stronger immediate leadership potential; a larger Ready in 1–2 years cohort signals pipeline depth for the medium term.` })
  sections.push({ heading: 'Successor Ranking', body: `Profiles in the Ready Now band (**${readyNow}**) rank highest for immediate succession, followed by the Ready in 1–2 years cohort (**${readyLater}**). Ranking is driven by the calculated readiness score, not by judgment alone.` })
  sections.push({ heading: 'Risk Analysis', body: `**${development}** profile(s) are in the Development Needed category — the primary succession risk. The higher this count relative to Ready Now profiles, the greater the exposure to leadership gaps for critical roles.` })
  sections.push({ heading: 'Development Recommendations', body: `Prioritize development for the **${development}** Development Needed profile(s) to build near-term pipeline depth. The goal is to move profiles toward Ready Now, balancing the current **${readyNow}**-strong immediate cohort.` })
  return sections
}

function buildRecognitionSections(metrics, details = {}) {
  const sections = []
  const completed = n(metrics.completed_count || 0)
  const active = n(metrics.active_count || 0)
  sections.push({ heading: 'Recognition Trends', body: `Recognition activity includes **${completed}** completed and **${active}** active recognition workflow(s). The completed-to-active ratio shows whether recognition is being delivered promptly or accumulating in review.` })
  sections.push({ heading: 'Frequently Recognized Employees', body: details.top_name ? `**${details.top_name}** is linked to **${n(details.top_count)}** recognition workflow(s), the highest recorded count. Recognized employees clustered at the top indicate which behaviors are being celebrated most.` : 'Insufficient records exist to identify frequently recognized employees; no recognition distribution can yet be assessed.' })
  sections.push({ heading: 'Team Engagement', body: `Recognition participation is reflected in the **${completed}** completed nominations. ${completed > 0 ? 'Higher completed counts indicate stronger engagement with the recognition process.' : 'No completed nominations are recorded, so team engagement with recognition cannot yet be confirmed.'}` })
  sections.push({ heading: 'Employees Needing Recognition', body: `Active recognition workflows (**${active}**) represent nominations still under review. Eligible employees may benefit from timely validation, and clearing the queue can improve recognition responsiveness.` })
  sections.push({ heading: 'Recognition Distribution', body: `Completed recognition workflows (**${completed}**) show recognition distributed across the organization. The mix of completed and active records (**${active}**) illustrates how evenly recognition is being spread over time.` })
  return sections
}

const MODULE_BUILDERS = {
  performance: buildPerformanceSections,
  competency: buildCompetencySections,
  learning: buildLearningSections,
  training: buildTrainingSections,
  succession: buildSuccessionSections,
  recognition: buildRecognitionSections,
}

function buildExecutiveSections(metrics) {
  const m = metrics
  const sections = []
  const perf = pct(m.workforce.average_performance)
  const comp = pct(m.workforce.average_competency)
  const learn = pct(m.workforce.learning_completion)
  const activeWorkflowsTotal = (m.activeWorkflows || []).reduce((s, r) => s + Number(r.count || 0), 0)
  const trainingTotal = n(m.training?.completed_count || 0) + n(m.training?.active_count || 0)
  const trainingRate = trainingTotal > 0 ? Math.round((n(m.training?.completed_count || 0) / trainingTotal) * 100) : 0
  const compGap = 100 - n(m.workforce.average_competency)
  const perfCompDelta = n(m.workforce.average_performance) - n(m.workforce.average_competency)
  const learningShortfall = 100 - n(m.workforce.learning_completion)

  // Workforce Overview — one concise paragraph on overall workforce health.
  sections.push({
    heading: 'Workforce Overview',
    body: `The organization has **${n(m.workforce.employee_count)}** active employees with average performance of **${perf}**, competency of **${comp}**, and learning completion of **${learn}**, supported by **${activeWorkflowsTotal}** active workflow(s). Overall workforce health is ${perfCompDelta >= 0 ? 'sound, with performance meeting or exceeding the capability base.' : 'mixed, with performance trailing established competency.'}`,
  })

  // Department Performance & Competency Analysis — 3-5 concise bullets.
  const deptBullets = []
  if (m.departments.length) {
    const avgPerf = m.departments.reduce((s, d) => s + Number(d.performance || 0), 0) / m.departments.length
    const above = m.departments.filter(d => Number(d.performance) >= avgPerf)
    const below = m.departments.filter(d => Number(d.performance) < avgPerf)
    if (above.length) deptBullets.push(`Departments performing above average (${pct(Math.round(avgPerf))}): **${above.map(d => d.department).join(', ')}**.`)
    if (below.length) deptBullets.push(`Departments needing attention (below average): **${below.map(d => d.department).join(', ')}**.`)
    const gaps = m.departments.filter(d => Number(d.performance) > 0 && Number(d.competency) > 0 && (Number(d.competency) - Number(d.performance)) >= 10)
    if (gaps.length) deptBullets.push(`Capability gaps: **${gaps.map(d => d.department).join(', ')}** show competency exceeding performance by 10+ points, indicating under-applied capability.`)
    else if (m.departments.length) deptBullets.push('No department shows a 10+ point gap between competency and performance.')
  } else {
    deptBullets.push('Insufficient records are available to generate this insight.')
  }
  sections.push({
    heading: 'Department Performance & Competency Analysis',
    body: deptBullets.slice(0, 5).map(b => `- ${b}`).join('\n'),
  })

  // Learning & Training Effectiveness — one short paragraph + 2 bullets.
  const trainingNote = trainingTotal > 0
    ? `Training delivery is **${trainingRate}%** complete (**${n(m.training.completed_count)}** of **${trainingTotal}** workflows).`
    : 'Insufficient training records are available to assess training effectiveness.'
  const learningBullets = []
  learningBullets.push(m.workforce.learning_completion > 0
    ? `Learning completion of **${learn}** reflects employee engagement; the **${learningShortfall}**-point shortfall to full completion is the primary development gap.`
    : 'Insufficient learning records are available to assess development progress.')
  learningBullets.push(trainingTotal > 0
    ? `Training participation spans **${n(m.training.active_count)}** active and **${n(m.training.completed_count)}** completed workflow(s); prioritize the active queue to raise completion.`
    : 'No training participation is recorded; assign training workflows before assessing effectiveness.')
  sections.push({
    heading: 'Learning & Training Effectiveness',
    body: `Employees are at **${learn}** learning completion on average. ${trainingNote}\n${learningBullets.map(b => `- ${b}`).join('\n')}`,
  })

  // Succession & Recognition Analysis — one short paragraph + 2 bullets.
  const successionNote = n(m.succession.ready_now_count) > 0 || n(m.succession.ready_later_count) > 0 || n(m.succession.development_count) > 0
    ? `The leadership pipeline holds **${n(m.succession.ready_now_count)}** Ready Now, **${n(m.succession.ready_later_count)}** Ready in 1–2 years, and **${n(m.succession.development_count)}** Development Needed profile(s).`
    : 'Insufficient succession records are available to assess leadership readiness.'
  const successionBullets = []
  successionBullets.push(n(m.succession.ready_now_count) > 0
    ? `Leadership readiness: **${n(m.succession.ready_now_count)}** profile(s) are immediately ready for expanded responsibility.`
    : 'No Ready Now profiles are recorded; leadership readiness cannot be confirmed.')
  successionBullets.push(n(m.recognition.completed_count) > 0
    ? `Recognition is active with **${n(m.recognition.completed_count)}** completed and **${n(m.recognition.active_count)}** pending workflow(s), indicating ongoing engagement.`
    : 'Insufficient recognition records are available to assess recognition trends.')
  sections.push({
    heading: 'Succession & Recognition Analysis',
    body: `${successionNote} Recognition activity totals **${n(m.recognition.completed_count)}** completed and **${n(m.recognition.active_count)}** active. ${n(m.recognition.completed_count) > 0 ? 'A healthy completed-to-active ratio indicates people processes are being carried through to outcomes.' : 'Recognition engagement is not yet confirmed.'}\n${successionBullets.map(b => `- ${b}`).join('\n')}`,
  })

  // Organizational Strengths — exactly 3 bullets derived from top metrics.
  const strengths = []
  if (comp >= 70) strengths.push(`High average competency (**${comp}**) provides a solid capability base.`)
  else strengths.push('Average competency is being tracked as a capability baseline.')
  if (n(m.succession.ready_now_count) > 0) strengths.push(`Strong leadership readiness with **${n(m.succession.ready_now_count)}** Ready Now profile(s).`)
  else if (m.departments.length && m.departments.every(d => Number(d.performance) >= 70)) strengths.push('Consistent performance across departments.')
  if (n(m.training.completed_count) > 0 || n(m.recognition.completed_count) > 0) strengths.push(`Completed recognition (**${n(m.recognition.completed_count)}**) and training (**${n(m.training.completed_count)}**) workflows show disciplined people-process execution.`)
  while (strengths.length < 3) strengths.push('People processes are being documented through the workflow system for ongoing visibility.')
  sections.push({
    heading: 'Organizational Strengths',
    body: strengths.slice(0, 3).map(s => `- ${s}`).join('\n'),
  })

  // Priority Actions & Executive Recommendations — exactly 5 data-backed bullets.
  const recommendations = []
  const topQueue = m.activeWorkflows[0]
  if (topQueue) recommendations.push(`Clear the largest workflow queue at **${topQueue.current_stage.replaceAll('_', ' ')}** (**${n(topQueue.count)}** record(s)) to unblock progress across modules.`)
  else recommendations.push('Establish active workflow queues to keep development processes moving.')
  if (compGap > 0) recommendations.push(`Target the **${compGap}**-point competency gap through prioritized development plans.`)
  else recommendations.push('Sustain current competency levels with continued development investment.')
  if (perfCompDelta < 0) recommendations.push(`Realign roles or expectations where performance (**${perf}**) trails competency (**${comp}**).`)
  recommendations.push(learningShortfall > 0
    ? `Convert learning into capability by closing the **${learningShortfall}**-point learning completion shortfall.`
    : 'Maintain full learning completion to sustain the capability pipeline.')
  recommendations.push(n(m.succession.development_count) > 0
    ? `Build pipeline depth for the **${n(m.succession.development_count)}** Development Needed succession profile(s).`
    : trainingTotal > 0 ? `Raise training completion (**${trainingRate}%**) by clearing active training workflows.` : 'Assign training workflows to build a measurable training baseline.')
  sections.push({
    heading: 'Priority Actions & Executive Recommendations',
    body: recommendations.slice(0, 5).map(r => `- ${r}`).join('\n'),
  })

  return sections
}

// Employee-scoped report builder. Generates a PERSONAL AI insight for a single
// employee based on their own metrics and their own module activity. This is
// used when an employee (or HR viewing a specific individual) generates an AI
// insight for a completed workflow — so the report is about THAT employee, not
// the whole organization.
function buildEmployeeSections(module, m = {}) {
  const sections = []
  const name = m.employee_name || 'This employee'
  const perf = pct(m.performance_score)
  const comp = pct(m.competency_score)
  const learn = pct(m.learning_progress)
  const completed = n(m.completed_count || 0)
  const active = n(m.active_count || 0)

  // Employee Overview — one concise paragraph.
  const overview = m.department ? `${name} (${m.department}${m.job_title ? ` — ${m.job_title}` : ''})` : name
  sections.push({
    heading: 'Overview',
    body: `${overview} has performance of **${perf}**, competency of **${comp}**, and learning completion of **${learn}**. In the **${module}** module, there ${active === 1 ? 'is' : 'are'} **${active}** active and **${completed}** completed workflow(s).`,
  })

  // Module-specific analysis — one short paragraph + 2 bullets.
  if (module === 'training') {
    const total = active + completed
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    sections.push({
      heading: 'Module Analysis',
      body: `${name} has **${completed}** completed and **${active}** active training workflow${active === 1 ? '' : 's'}. ${total > 0 ? `This reflects a **${rate}%** personal completion rate for recorded training activity.` : 'No personal training activity is currently recorded.'}`,
    })
  } else if (module === 'performance') {
    sections.push({
      heading: 'Module Analysis',
      body: `Personal performance is **${perf}** against a competency base of **${comp}**. ${Number(m.performance_score) >= Number(m.competency_score) ? 'Performance is at or above the recorded competency base, indicating capability is being applied.' : 'Performance trails recorded competency, suggesting capability may not yet be fully applied in role.'}`,
    })
  } else if (module === 'competency') {
    sections.push({
      heading: 'Module Analysis',
      body: `Personal competency is **${comp}**, leaving a **${Math.max(0, 100 - Number(m.competency_score))}**-point gap to full proficiency. ${completed > 0 ? `${completed} competency workflow(s) have been completed.` : 'No competency workflows have been completed yet.'}`,
    })
  } else if (module === 'learning') {
    sections.push({
      heading: 'Module Analysis',
      body: `Personal learning completion is **${learn}**, leaving a **${Math.max(0, 100 - Number(m.learning_progress))}**-point shortfall to full completion. ${completed > 0 ? 'The learning target has been reached.' : 'The learning target has not yet been fully reached.'}`,
    })
  } else if (module === 'succession') {
    sections.push({
      heading: 'Module Analysis',
      body: `Personal readiness score is **${pct(m.readiness_score)}** with a readiness band of **${(m.readiness_band || 'none').replaceAll('_', ' ')}**. ${m.readiness_band === 'ready_now' ? 'This indicates readiness for immediate expanded responsibility.' : m.readiness_band === 'ready_in_1_2_years' ? 'This indicates readiness within 1–2 years with continued development.' : 'This indicates development is still needed before succession readiness.'}`,
    })
  } else if (module === 'recognition') {
    sections.push({
      heading: 'Module Analysis',
      body: `${name} has **${completed}** completed and **${active}** active recognition workflow${active === 1 ? '' : 's'}. ${completed > 0 ? 'Completed recognition records indicate recognized contributions.' : 'No completed recognition records are available for this employee.'}`,
    })
  } else {
    sections.push({
      heading: 'Module Analysis',
      body: `${name} has **${completed}** completed and **${active}** active workflow(s) in the **${module}** module.`,
    })
  }

  // Personal strengths — 2 bullets.
  const strengths = []
  if (Number(m.performance_score) >= 70) strengths.push(`Strong personal performance (**${perf}**).`)
  if (Number(m.competency_score) >= 70) strengths.push(`Solid competency base (**${comp}**).`)
  if (Number(m.learning_progress) >= 70) strengths.push(`Good learning engagement (**${learn}**).`)
  if (completed > 0) strengths.push(`Demonstrated completion of **${completed}** ${module} workflow(s).`)
  while (strengths.length < 2) strengths.push('Personal metrics are being tracked through the workflow system.')
  sections.push({
    heading: 'Strengths',
    body: strengths.slice(0, 2).map(s => `- ${s}`).join('\n'),
  })

  // Personal recommended actions — 2-3 data-backed bullets.
  const actions = []
  if (Number(m.competency_score) < 70) actions.push(`Build capability by closing the **${Math.max(0, 100 - Number(m.competency_score))}**-point competency gap.`)
  if (Number(m.performance_score) < Number(m.competency_score)) actions.push('Seek coaching or role alignment where performance trails competency.')
  if (Number(m.learning_progress) < 100) actions.push(`Continue learning to close the **${Math.max(0, 100 - Number(m.learning_progress))}**-point learning completion shortfall.`)
  if (active > 0) actions.push(`Complete the **${active}** active ${module} workflow(s) to keep personal progress moving.`)
  if (module === 'succession' && Number(m.readiness_score) < 70) actions.push('Focus development on readiness to move toward the Ready Now band.')
  while (actions.length < 2) actions.push('Maintain current personal progress within the module.')
  sections.push({
    heading: 'Recommended Actions',
    body: actions.slice(0, 3).map(a => `- ${a}`).join('\n'),
  })

  return sections
}

// ------------------------------ Summary builder -----------------------------

function buildSummary(module, metrics, details = {}) {
  const title = module === 'executive'
    ? 'Executive Workforce Analytics Report'
    : `${module[0].toUpperCase()}${module.slice(1)} Management Report`
  const dataContext = computeDataContext(module, metrics)
  const sections = module === 'executive'
    ? buildExecutiveSections(metrics)
    : MODULE_BUILDERS[module](metrics, details)
  // Prepend the data-transparency sections so the user always sees which
  // datasets were analyzed and how confident the report is in its findings.
  const allSections = [dataCompletenessSection(dataContext), datasetsSection(dataContext), ...sections]
  const summary = allSections.map(s => `## ${s.heading}\n${s.body}`).join('\n\n')
  return { title, summary, sections: allSections, dataContext }
}

// ------------------------------ Metric queries ------------------------------

import { getScopeFilter } from '../services/departmentScope.js'

export async function calculateMetrics(module, { employeeId = null, department = null } = {}, db = { query }) {
  const run = (text, params) => db.query(text, params)
  // Employee-scoped metrics — used for a single employee's PERSONAL AI insight.
  if (employeeId) {
    const generation = await run(EMPLOYEE_METRIC_QUERIES[module], [employeeId])
    return { metrics: generation.rows[0], details: {} }
  }

  // Department-scoped metrics for module-level insights (e.g., supervisor views).
  if (department) {
    const baseQuery = MODULE_METRIC_QUERIES[module]
    const scopedQuery = baseQuery.includes('WHERE')
      ? baseQuery.replace('WHERE', `WHERE department = $1 AND`)
      : `${baseQuery} WHERE department = $1`
    const generation = await run(scopedQuery, [department])
    return { metrics: generation.rows[0], details: {} }
  }

  // Executive (org-wide) metrics.
  if (module === 'executive') {
    const [workforce, departments, workflows, succession, recognition, training] = await Promise.all([
      run(EXECUTIVE_METRIC_QUERIES.workforce),
      run(EXECUTIVE_METRIC_QUERIES.departments),
      run(EXECUTIVE_METRIC_QUERIES.workflows),
      run(EXECUTIVE_METRIC_QUERIES.succession),
      run(EXECUTIVE_METRIC_QUERIES.recognition),
      run(EXECUTIVE_METRIC_QUERIES.training),
    ])
    const activeWorkflows = workflows.rows.sort((a, b) => Number(b.count) - Number(a.count))
    const executiveMetrics = {
      workforce: workforce.rows[0],
      departments: departments.rows,
      activeWorkflows,
      succession: succession.rows[0],
      recognition: recognition.rows[0],
      training: training.rows[0],
    }
    return {
      metrics: executiveMetrics,
      ...executiveMetrics,
    }
  }

  // Module-level metrics (org-wide when no department parameter).
  const generation = await run(MODULE_METRIC_QUERIES[module])
  const detailsQuery = module === 'performance'
    ? `SELECT (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score DESC NULLS LAST, full_name LIMIT 1) AS top_name,
        (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score DESC NULLS LAST, full_name LIMIT 1) AS top_score,
        (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score ASC NULLS LAST, full_name LIMIT 1) AS bottom_name,
        (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score ASC NULLS LAST, full_name LIMIT 1) AS bottom_score`
    : module === 'recognition'
      ? `SELECT e.full_name AS top_name, count(*)::int AS top_count FROM workflows w JOIN employees e ON e.id=w.subject_employee_id WHERE w.module='recognition' GROUP BY e.full_name ORDER BY count(*) DESC NULLS LAST, e.full_name LIMIT 1`
      : `SELECT NULL::text AS top_name`
  const details = await run(detailsQuery)
  return { metrics: generation.rows[0], details: details.rows[0] }
}

// -------------------------------- AI builder --------------------------------

export async function generateAI(module, metrics, details = {}) {
  // Always persist the structured, deterministic summary so the report viewer
  // reliably renders the required module / executive sections. The LLM is used
  // as an optional enrichment of the same evidence-based summary; a failure
  // never blocks report persistence.
  const built = buildSummary(module, metrics, details)
  let content = built.summary
  try {
    const insights = await generateInsights({ moduleWorkflow: { module, stage: 'completed', scope: 'organization-wide' }, moduleMetrics: metrics, moduleDetails: details, executiveMetrics: metrics, dataContext: built.dataContext })
    if (Array.isArray(insights) && insights[0]?.summary && built.sections.every(section => insights[0].summary.includes(`## ${section.heading}`))) content = insights[0].summary
  } catch (error) {
    console.warn('[aiReports] LLM enrichment failed, using structured summary:', error.message)
  }
  return { title: built.title, summary: built.summary, content, sections: built.sections, dataContext: built.dataContext }
}

// ------------------------------ Report saving -------------------------------

export async function saveReport(report, { workflowId = null, employeeId = null, module, createdBy = null, scope = 'organization-wide' }) {
  const metricsJson = report.metricsJson || {}
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflowId, module, report.title, report.summary, report.content, JSON.stringify(metricsJson), JSON.stringify(recommendationsJson), scope, employeeId, config.openRouterModel || 'template', '1.0', createdBy],
  )
  return rows[0]
}

export async function saveReportForWorkflow(client, report, workflow, createdBy, metrics) {
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await client.query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflow.id, workflow.module, report.title, report.summary, report.content, JSON.stringify(metrics), JSON.stringify(recommendationsJson), 'organization-wide', workflow.subject_employee_id, config.openRouterModel || 'template', '1.0', createdBy],
  )
  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details, ai_report_id)
     VALUES ($1,$2,'ai_report',$3,$4,$5,$6)`,
    [workflow.id, workflow.current_stage, createdBy, 'AI report generated and saved to the workflow.', { aiReportId: rows[0].id }, rows[0].id],
  )
  return rows[0]
}

// --------------------------- Metric persistence -----------------------------

// Save the calculated module metrics for a completed workflow WITHOUT generating
// an AI report. The UI shows a "Ready to Generate AI Report" state and HR
// generates the report on demand. Metrics are stored so the report can be
// generated or regenerated later using the same calculated values.
export async function saveMetricsForWorkflow(client, workflow, createdBy, metrics) {
  const module = workflow.module
  const title = `${module[0].toUpperCase()}${module.slice(1)} Management Report`
  const built = buildSummary(module, metrics)
  const { rows } = await client.query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflow.id, module, title, built.summary, built.summary, JSON.stringify(metrics), JSON.stringify([]), 'organization-wide', workflow.subject_employee_id, null, null, createdBy],
  )
  // Record the metrics-only placeholder in the audit trail (no AI report yet).
  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details, ai_report_id)
     VALUES ($1,$2,'note',$3,$4,$5,$6)`,
    [workflow.id, workflow.current_stage, createdBy, 'Workflow completed. Metrics calculated and saved. AI report ready to generate.', { metricsPreview: true, aiReportId: rows[0].id }, rows[0].id],
  )
  return rows[0]
}

// --------------------------- Combined orchestration -------------------------

// Generate + save a report for a completed workflow. Never throws so workflow
// completion is never blocked by AI failure.
export async function generateAndSaveForWorkflow(client, workflow, createdBy) {
  try {
    const { metrics, details } = await calculateMetrics(workflow.module)
    const report = await generateAI(workflow.module, metrics, details)
    const saved = await saveReportForWorkflow(client, { ...report, metricsJson: metrics }, workflow, createdBy, metrics)
    return { saved: true, reportId: saved.id }
  } catch (error) {
    console.warn('[aiReports] Skipping AI report generation for workflow:', error.message)
    return { saved: false, error: error.message }
  }
}

// Build a deterministic PERSONAL summary for a single employee on a given module.
function buildEmployeeSummary(module, metrics) {
  const name = metrics?.employee_name || 'This employee'
  const title = `${name} — ${module[0].toUpperCase()}${module.slice(1)} AI Insight`
  const sections = buildEmployeeSections(module, metrics || {})
  const summary = sections.map(s => `## ${s.heading}\n${s.body}`).join('\n\n')
  return { title, summary, sections }
}

// Generate a PERSONAL AI insight for a specific employee + module. This differs
// from generateAI (org-wide) by using the employee-scoped metrics and building
// the report around that individual's own performance/competency/learning and
// their own module workflow activity.
export async function generateEmployeeAI(module, metrics, details = {}) {
  const built = buildEmployeeSummary(module, metrics)
  let content = built.summary
  try {
    const insights = await generateInsights({
      moduleWorkflow: { module, stage: 'completed', scope: 'employee-specific' },
      moduleMetrics: metrics,
      moduleDetails: details,
      executiveMetrics: metrics,
      employeeMetrics: metrics,
      dataContext: { datasets: [{ label: 'Personal records', count: 1 }], confidence: 100, completeness: 'high' },
    })
    if (insights[0]?.summary && built.sections.every(section => insights[0].summary.includes(`## ${section.heading}`))) content = insights[0].summary
  } catch (error) {
    console.warn('[aiReports] LLM enrichment failed for employee AI insight, using structured summary:', error.message)
  }
  return { title: built.title, summary: built.summary, content, sections: built.sections, dataContext: { datasets: [{ label: 'Personal records', count: 1 }], confidence: 100, completeness: 'high' } }
}

// Generate an AI report for a workflow on demand using live module metrics.
// When the workflow has a subject employee (employee-specific), the report is
// built as a PERSONAL AI insight about THAT employee. If no subject employee
// exists, the org-wide module report is generated.
export async function generateOnDemand(workflowId, createdBy) {
  const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [workflowId])
  const workflow = rows[0]
  if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })

  let report
  let metrics
  if (workflow.subject_employee_id) {
    metrics = (await calculateMetrics(workflow.module, { employeeId: workflow.subject_employee_id })).metrics
    report = await generateEmployeeAI(workflow.module, metrics)
  } else {
    const calc = await calculateMetrics(workflow.module)
    metrics = calc.metrics
    report = await generateAI(workflow.module, metrics, calc.details)
  }
  const saved = await saveReportForWorkflow({ query }, { ...report, metricsJson: metrics }, workflow, createdBy, metrics)
  return saved
}

export async function saveExecutiveReport(report, createdBy, metrics) {
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await query(
    `INSERT INTO ai_reports (module, title, summary, content, metrics_json, recommendations_json, scope, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    ['executive', report.title, report.summary, report.content, JSON.stringify(metrics), JSON.stringify(recommendationsJson), 'organization-wide', config.openRouterModel || 'template', '1.0', createdBy],
  )
  return rows[0]
}

export async function getLatestReports(module, { limit = 1 } = {}) {
  const { rows } = await query(
    `SELECT * FROM ai_reports WHERE module=$1 ORDER BY created_at DESC LIMIT $2`,
    [module, limit],
  )
  return rows
}

export async function getReportsForWorkflow(workflowId) {
  const { rows } = await query(
    `SELECT * FROM ai_reports WHERE workflow_id=$1 ORDER BY created_at DESC`,
    [workflowId],
  )
  return rows
}
