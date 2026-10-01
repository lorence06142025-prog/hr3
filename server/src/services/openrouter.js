import { config } from '../config.js'

// ---------------------------------------------------------------------------
// Real LLM integration via OpenRouter.
//
// When OPENROUTER_API_KEY is configured, insight generation calls the actual
// OpenRouter chat-completions endpoint. When no key is present (or the call
// fails), we fall back to the deterministic template-based reports so the
// product keeps working in demos and offline environments.
// ---------------------------------------------------------------------------

const n = value => Number(value || 0)
const pct = value => `${n(value)}%`
const total = rows => rows.reduce((sum, row) => sum + n(row.count), 0)
const queue = rows => rows[0] ? `${n(rows[0].count)} record(s) are currently at ${rows[0].current_stage.replaceAll('_', ' ')}` : 'no active workflow records are currently awaiting action'

const report = (title, paragraphs) => {
  const [overview = '', analysis = '', strengths = '', attention = '', recommendations = attention] = paragraphs
  return {
    title,
    summary: `# ${title}\n\n## Overview\n${overview}\n\n## Analysis\n${analysis}\n\n## Strengths\n${strengths}\n\n## Areas Requiring Attention\n${attention}\n\n## Recommendations\n${recommendations}`,
  }
}

// --------------------------- Template fallback ------------------------------

function moduleInsights({ moduleWorkflow, moduleMetrics: m = {}, moduleDetails: d = {}, activeModuleWorkflows: rows = [] }) {
  const active = total(rows)
  const currentQueue = queue(rows)
  const action = rows[0]
    ? `HR should review the ${rows[0].current_stage.replaceAll('_', ' ')} queue before progressing those records, ensuring the documented evidence and reviewer input are complete.`
    : 'HR should review the current records before initiating additional actions, so that development decisions remain grounded in the available evidence.'
  const reports = {
    performance: [report('Performance Management Report', [
      `Workforce overview. The performance review population includes ${n(m.employee_count)} active employee records with an average performance score of ${pct(m.average_score)}. There are ${n(m.completed_count)} completed reviews and ${n(m.active_count)} active review workflows, providing a current view of both workforce outcomes and review execution.`,
      d.top_name ? `Key findings. ${d.top_name} has the highest recorded score at ${pct(d.top_score)}, while ${d.bottom_name} has the lowest at ${pct(d.bottom_score)}. This range identifies where HR can recognize sustained contribution and where a more detailed coaching conversation may be appropriate after reviewing the underlying evidence.` : 'Key findings. No active performance employee records are available for a high and low comparison.',
      `Data interpretation and strengths. ${currentQueue}. The average score provides a balanced workforce indicator, while completed reviews show that part of the evaluation process has reached a documented conclusion. Consistent completion of remaining reviews is important because performance evidence informs development and recognition discussions.`,
      `Areas requiring attention and recommended HR actions. Active review workflows represent outstanding evaluation activity that should be closed in the correct sequence. ${action} HR may consider coaching or targeted development planning for lower recorded scores only after validating role expectations, context, and manager feedback.`,
    ])],
    competency: [report('Competency Management Report', [
      `Workforce overview. ${n(m.employee_count)} active employee records have an average competency score of ${pct(m.average_score)}, and ${active} competency workflow(s) are currently active. This provides a current indicator of workforce capability and development activity.`,
      `Key findings. ${currentQueue}. The average competency score is most useful when considered alongside the workflow queue, because open development activity indicates that capability records are still being reviewed or updated.`,
      'Data interpretation and strengths. The recorded competency average reflects the organization’s present capability level across the included employees. Active development workflows are a positive sign that capability development is being managed through an accountable process rather than left informal.',
      `Areas requiring attention and recommended HR actions. The active queue should be reviewed to confirm that development plans align with the competency evidence already recorded. ${action} HR should prioritize learning or coaching discussions for records that require competency review, while retaining manager judgment over the final development action.`,
    ])],
    learning: [report('Learning Management Report', [
      `Workforce overview. Learning progress averages ${pct(m.average_score)} across ${n(m.employee_count)} active employee records, and ${n(m.completed_count)} record(s) have reached 100% learning progress. These values show the current level of learning completion across the monitored population.`,
      `Key findings. ${currentQueue}. Completed learning records demonstrate that some employees have met the recorded learning target, while the difference between the average progress and full completion identifies remaining development activity for HR and managers to monitor.`,
      'Data interpretation and strengths. The completion count provides evidence of achieved learning progress, and the active workflow queue shows that learning is being managed through assigned stages. Maintaining follow-through on incomplete records supports consistent capability development.',
      `Areas requiring attention and recommended HR actions. Records below full completion warrant a review of their current learning workflow stage and any related support needs. ${action} HR should use the recorded learning progress when planning next learning activities, with individual requirements confirmed through the normal review process.`,
    ])],
    training: [report('Training Management Report', [
      `Workforce overview. Training activity includes ${n(m.active_count)} active and ${n(m.completed_count)} completed training workflow(s). ${n(m.scheduled_count)} training workflow(s) have a confirmed schedule, showing the portion of activity that has progressed to planned delivery.`,
      `Key findings. ${currentQueue}. The relationship between scheduled, active, and completed workflows provides an implementation view: scheduled activity is prepared for delivery, while completed workflows indicate training processes that have reached their recorded endpoint.`,
      'Data interpretation and strengths. Confirmed schedules support operational planning and give managers a basis for coordinating participation. Completed workflows show that some training activity has been carried through the current process.',
      `Areas requiring attention and recommended HR actions. Active workflows should be reviewed so that the next required training stage is documented without delay. ${action} HR should assess training outcomes through the evidence available in each workflow before deciding whether additional delivery or follow-up is needed.`,
    ])],
    succession: [report('Succession Planning Report', [
      `Workforce overview. ${n(m.candidate_count)} succession profile(s) have an average readiness score of ${pct(m.average_readiness)}. The current distribution is ${n(m.ready_now_count)} Ready Now, ${n(m.ready_later_count)} Ready in 1–2 years, and ${n(m.development_count)} Development Needed profile(s).`,
      `Key findings. ${currentQueue}. The readiness distribution provides a view of near-term and longer-term talent availability, with Ready Now profiles representing the strongest immediate pipeline indicator in the analyzed records.`,
      'Data interpretation and strengths. The presence of Ready Now and Ready in 1–2 years profiles indicates that succession readiness is being assessed across more than one time horizon. Development Needed profiles identify where focused capability building may be relevant before future succession consideration.',
      `Areas requiring attention and recommended HR actions. HR should review profiles in the Development Needed category alongside the active succession queue to determine where development discussions should be prioritized. ${action} Final successor decisions should remain with the authorized reviewers after considering the full candidate evidence.`,
    ])],
    recognition: [report('Social Recognition Report', [
      `Workforce overview. Recognition activity includes ${active} active and ${n(m.completed_count)} completed recognition workflow(s). This provides a current view of nominations or recognition records moving through the organization’s review process.`,
      d.top_name ? `Key findings. ${d.top_name} is linked to ${n(d.top_count)} recognition workflow(s), the highest recorded count in the analyzed recognition records. This indicates the greatest recorded recognition activity for an individual, while final recognition quality remains subject to the established review process.` : 'Key findings. No employee-level recognition comparison is available from the current recognition records.',
      `Data interpretation and strengths. ${currentQueue}. Completed recognition workflows demonstrate that recognition activity can reach a documented outcome, while active records show that recognition remains under review rather than being decided automatically.`,
      `Areas requiring attention and recommended HR actions. The active queue should be reviewed promptly so valid nominations receive timely validation and feedback. ${action} HR may consider recognition for eligible employees only after reviewing the documented achievement and approval evidence.`,
    ])],
  }
  return reports[moduleWorkflow.module]
}

// PERSONAL AI insight for a single employee generated from their OWN metrics
// (performance, competency, learning, and their own module activity). This must
// never surface org-wide averages — it is scoped to the employee only.
function employeeInsights({ moduleWorkflow, employeeMetrics: m = {} }) {
  const module = moduleWorkflow?.module || 'development'
  const name = m.employee_name || 'This employee'
  const perf = pct(m.performance_score)
  const comp = pct(m.competency_score)
  const learn = pct(m.learning_progress)
  const completed = n(m.completed_count)
  const active = n(m.active_count)
  const overview = m.department ? `${name} (${m.department}${m.job_title ? ` — ${m.job_title}` : ''})` : name

  const analysis = module === 'training'
    ? `${name} has **${completed}** completed and **${active}** active training workflow(s). ${(completed + active) > 0 ? `This reflects a **${Math.round((completed / (completed + active)) * 100)}%** personal completion rate for recorded training activity.` : 'No personal training activity is currently recorded.'}`
    : module === 'performance'
      ? `Personal performance is **${perf}** against a competency base of **${comp}**. ${n(m.performance_score) >= n(m.competency_score) ? 'Performance is at or above the recorded competency base, indicating capability is being applied.' : 'Performance trails recorded competency, suggesting capability may not yet be fully applied in role.'}`
      : module === 'competency'
        ? `Personal competency is **${comp}**, leaving a **${Math.max(0, 100 - n(m.competency_score))}**-point gap to full proficiency. ${completed > 0 ? 'Competency workflow(s) have been completed.' : 'No competency workflows have been completed yet.'}`
        : module === 'learning'
          ? `Personal learning completion is **${learn}**, leaving a **${Math.max(0, 100 - n(m.learning_progress))}**-point shortfall to full completion. ${completed > 0 ? 'The learning target has been reached.' : 'The learning target has not yet been fully reached.'}`
          : module === 'succession'
            ? `Personal readiness score is **${pct(m.readiness_score)}** with a readiness band of **${(m.readiness_band || 'none').replaceAll('_', ' ')}**.`
            : module === 'recognition'
              ? `${name} has **${completed}** completed and **${active}** active recognition workflow(s). ${completed > 0 ? 'Completed recognition records indicate recognized contributions.' : 'No completed recognition records are available for this employee.'}`
              : `${name} has **${completed}** completed and **${active}** active workflow(s) in the **${module}** module.`

  const strengths = []
  if (n(m.performance_score) >= 70) strengths.push(`Strong personal performance (**${perf}**).`)
  if (n(m.competency_score) >= 70) strengths.push(`Solid competency base (**${comp}**).`)
  if (n(m.learning_progress) >= 70) strengths.push(`Good learning engagement (**${learn}**).`)
  if (completed > 0) strengths.push(`Demonstrated completion of **${completed}** ${module} workflow(s).`)
  while (strengths.length < 2) strengths.push('Personal metrics are being tracked through the workflow system.')

  const actions = []
  if (n(m.competency_score) < 70) actions.push(`Build capability by closing the **${Math.max(0, 100 - n(m.competency_score))}**-point competency gap.`)
  if (n(m.performance_score) < n(m.competency_score)) actions.push('Seek coaching or role alignment where performance trails competency.')
  if (n(m.learning_progress) < 100) actions.push(`Continue learning to close the **${Math.max(0, 100 - n(m.learning_progress))}**-point learning completion shortfall.`)
  if (active > 0) actions.push(`Complete the **${active}** active ${module} workflow(s) to keep personal progress moving.`)
  if (module === 'succession' && n(m.readiness_score) < 70) actions.push('Focus development on readiness to move toward the Ready Now band.')
  while (actions.length < 2) actions.push('Maintain current personal progress within the module.')

  return [report(`${overview} — Personal AI Insight`, [
    `Personal overview. ${overview} has performance of **${perf}**, competency of **${comp}**, and learning completion of **${learn}**. In the **${module}** module, there ${active === 1 ? 'is' : 'are'} **${active}** active and **${completed}** completed workflow(s).`,
    analysis,
    'Strengths. ' + strengths.slice(0, 2).join(' '),
    'Recommended actions. ' + actions.slice(0, 3).join(' '),
  ])]
}

function dashboardInsights({ workforce = {}, departments = [], activeWorkflows = [], succession = {}, recognition = {}, employee }) {
  if (employee) return [report('Employee HR Analytics Report', [
    `Workforce overview. ${employee.full_name} has recorded performance of ${pct(employee.performance_score)}, competency of ${pct(employee.competency_score)}, and learning progress of ${pct(employee.learning_progress)}.`,
    'Key findings and interpretation. These measures provide a current view of performance, capability, and learning progress. Comparing the three recorded values helps focus discussion on the area with the lowest current result without assuming its cause.',
    'Recommended HR actions. HR and the manager should review the recorded evidence, discuss the employee’s development needs, and use the applicable workflow to document any agreed coaching or learning action.',
  ])]
  const best = departments.reduce((current, row) => !current || n(row.performance) > n(current.performance) ? row : current, null)
  const leading = activeWorkflows[0]
  const compGap = 100 - n(workforce.average_competency)
  const perfCompDelta = n(workforce.average_performance) - n(workforce.average_competency)
  const learningShortfall = 100 - n(workforce.learning_completion)
  const strengths = []
  if (n(workforce.average_competency) >= 70) strengths.push(`High average competency (**${pct(workforce.average_competency)}**) provides a solid capability base.`)
  if (n(succession.ready_now_count) > 0) strengths.push(`Strong leadership readiness with **${n(succession.ready_now_count)}** Ready Now profile(s).`)
  if (n(recognition.completed_count) > 0 || n(workforce.employee_count) > 0) strengths.push(`Completed recognition (**${n(recognition.completed_count)}**) workflows show disciplined people-process execution.`)
  while (strengths.length < 3) strengths.push('People processes are being documented through the workflow system for ongoing visibility.')
  const recommendations = []
  if (leading) recommendations.push(`Clear the largest workflow queue at **${leading.current_stage.replaceAll('_', ' ')}** (**${n(leading.count)}** record(s)) to unblock progress across modules.`)
  else recommendations.push('Establish active workflow queues to keep development processes moving.')
  if (compGap > 0) recommendations.push(`Target the **${compGap}**-point competency gap through prioritized development plans.`)
  if (perfCompDelta < 0) recommendations.push(`Realign roles or expectations where performance (**${pct(workforce.average_performance)}**) trails competency (**${pct(workforce.average_competency)}**).`)
  if (learningShortfall > 0) recommendations.push(`Convert learning into capability by closing the **${learningShortfall}**-point learning completion shortfall.`)
  if (n(succession.development_count) > 0) recommendations.push(`Build pipeline depth for the **${n(succession.development_count)}** Development Needed succession profile(s).`)
  return [report('Executive Workforce Analytics Report', [
    `Workforce overview. ${n(workforce.employee_count)} active employee records show average performance of **${pct(workforce.average_performance)}**, competency of **${pct(workforce.average_competency)}**, and learning completion of **${pct(workforce.learning_completion)}**. Overall workforce health is ${perfCompDelta >= 0 ? 'sound, with performance meeting or exceeding the capability base.' : 'mixed, with performance trailing established competency.'}`,
    `Department and competency findings. ${best ? `**${best.department}** is the top-performing department at **${pct(best.performance)}** across **${n(best.employees)}** employee records.` : 'Department performance records are not available.'} ${n(succession.ready_now_count) > 0 ? `**${n(succession.ready_now_count)}** profile(s) are Ready Now.` : 'No Ready Now profiles are recorded.'}`,
    `Department performance & competency analysis. Departments performing above average stand out as model areas, while those below average warrant closer attention. Capability gaps arise where competency exceeds performance by 10+ points, indicating under-applied skill. Learning completion of **${pct(workforce.learning_completion)}** reflects employee engagement, and training activity completes the learning picture. Succession readiness spans Ready Now, Ready in 1–2 years, and Development Needed profiles, balanced by **${n(recognition.completed_count)}** completed recognition workflows.`,
    'Organizational strengths. ' + strengths.slice(0, 3).join(' '),
    'Priority actions and executive recommendations. ' + recommendations.slice(0, 5).join(' '),
  ])]
}

// ----------------------- LLM prompt construction ----------------------------

function serializeContext(context) {
  return JSON.stringify(context, null, 2)
}

const MODULE_SECTIONS = {
  performance: ['Overall Performance Summary', 'KPI Analysis', 'Strengths', 'Areas Needing Improvement', 'Coaching Recommendations', 'Performance Trend', 'Readiness Score'],
  competency: ['Competency Summary', 'Missing Competencies', 'Skill Gap Analysis', 'Priority Skills', 'Development Recommendations', 'Readiness Assessment'],
  learning: ['Completion Analysis', 'Learning Engagement', 'Weak Learning Areas', 'Learning Effectiveness', 'Suggested Next Courses'],
  training: ['Attendance Analysis', 'Completion Rate', 'Training Effectiveness', 'Participants Needing Follow-up', 'Recommended Future Trainings'],
  succession: ['Readiness Summary', 'Leadership Potential', 'Successor Ranking', 'Risk Analysis', 'Development Recommendations'],
  recognition: ['Recognition Trends', 'Frequently Recognized Employees', 'Team Engagement', 'Employees Needing Recognition', 'Recognition Distribution'],
}

const EXECUTIVE_SECTIONS = ['Workforce Overview', 'Department Performance & Competency Analysis', 'Learning & Training Effectiveness', 'Succession & Recognition Analysis', 'Organizational Strengths', 'Priority Actions & Executive Recommendations']

function buildPrompt(context) {
  // Employee-specific scope — build a PERSONAL AI insight prompt from the
  // employee's own metrics, never the org-wide module/executive report.
  if (context.employeeMetrics && context.moduleWorkflow?.scope === 'employee-specific') {
    const m = context.employeeMetrics || {}
    const module = context.moduleWorkflow.module
    const name = m.employee_name || 'This employee'
    return {
      system: 'You are a personal HR development coach for a logistics employee. You analyze the employee\'s OWN recorded metrics and produce a concise, personal, actionable AI insight. Never reference organization-wide averages or other employees.',
      user: `Generate a concise PERSONAL AI insight for ${name}, scoped only to their own records. Use only the data provided below; do not invent values and do not mention org-wide data.

Use this structure with Markdown headings:
# ${name} — Personal AI Insight
## Overview
## Module Analysis
## Strengths
## Recommended Actions

Rules:
- Scope every statement to this employee only (their performance, competency, learning, and their own "${module}" workflow activity).
- Base every claim strictly on the provided personal metrics.
- Keep it concise and actionable — no org-wide statistics.
- If a personal metric has no record, explicitly state that insufficient records exist for that area.
- Keep the report under 300 words.

Here is the employee's personal context (JSON):
${serializeContext(m)}`,
    }
  }
  if (context.moduleWorkflow) {
    const moduleLabel = context.moduleWorkflow.module
    const stage = context.moduleWorkflow.stage
    const sections = MODULE_SECTIONS[moduleLabel] || ['Overview', 'Analysis', 'Strengths', 'Areas Requiring Attention', 'Recommendations']
    return {
      system: 'You are an expert HR workforce analytics assistant for a logistics organization. You analyze live workforce database values and produce evidence-based, structured HR management reports.',
      user: `Generate an HR analytics report for the "${moduleLabel}" module at stage "${stage}". Use only the data provided below; do not invent values.

Use this exact structure with Markdown headings:
# ${moduleLabel[0].toUpperCase()}${moduleLabel.slice(1)} Management Report
${sections.map(s => `## ${s}`).join('\n')}

Rules:
- Base every claim strictly on the provided data and actual numbers.
- Interpret relationships between metrics rather than only listing numbers — explain what score gaps mean, how completed vs active records relate, and what the data implies for action.
- Explain the meaning of each metric in professional HR language.
- If a dataset has no records, explicitly state that insufficient records exist for that area.
- Recommendations must be grounded in the calculated metrics.
- Keep the report under 450 words.

Here is the current database context (JSON):
${serializeContext(context)}`,
    }
  }
  if (context.employee) {
    return {
      system: 'You are an expert HR workforce analytics assistant for a logistics organization. You produce concise, evidence-based employee analytics reports.',
      user: `Generate a concise employee HR analytics report for ${context.employee.full_name}. Use only the provided data; do not invent values.

Use this structure with Markdown headings:
# <Report Title>
## Overview
## Analysis
## Strengths
## Areas Requiring Attention
## Recommendations

Interpret the relationships between the employee's performance, competency, and learning metrics rather than only restating them. Base every claim strictly on the provided data. Explain metric meaning, and if a metric has no data, explicitly state that insufficient records exist. Keep the report under 350 words.

Here is the employee context (JSON):
${serializeContext(context.employee)}`,
    }
  }
  return {
    system: 'You are an expert HR workforce analytics assistant for a logistics organization. You analyze live workforce database values and produce concise, evidence-based executive workforce analytics reports for HR Directors and Senior Managers.',
    user: `Generate a concise Executive Workforce Analytics Report for the organization. Use only data provided below; do not invent values.

Use this exact structure with Markdown headings:
# Executive Workforce Analytics Report
${EXECUTIVE_SECTIONS.map(s => `## ${s}`).join('\n')}

Rules:
- Base every claim strictly on the provided data and actual numbers.
- Merge related analyses into concise executive summaries; do not repeat statistics across sections.
- Workforce Overview: one short paragraph on overall workforce health.
- Department Performance & Competency Analysis: 3-5 concise bullets comparing departments, flagging above/below average, and linking competency to performance.
- Learning & Training Effectiveness: one short paragraph + 2 bullets. If training data lacks records, state that insufficient records exist to assess training effectiveness.
- Succession & Recognition Analysis: one short paragraph + 2 bullets on leadership readiness and recognition trends.
- Organizational Strengths: exactly 3 bullets listing only the top strengths.
- Priority Actions & Executive Recommendations: exactly 5 data-backed bullets using current metrics, workflow queues, department performance, competency gaps, and learning completion. Never recommend anything unsupported by data.
- If a dataset has no records, explicitly state that insufficient records exist for that area.
- Keep the report under 350 words.

Here is the current workforce context (JSON):
${serializeContext(context)}`,
  }
}

// --------------------------- OpenRouter client ------------------------------

async function callOpenRouter(context) {
  const { system, user } = buildPrompt(context)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'HTTP-Referer': config.clientOrigin,
      'X-Title': 'Priority Handling Services, Inc.',
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenRouter request failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter returned an empty response.')
  return content
}

// Take raw LLM Markdown and normalize it into the [{ title, summary }] shape the UI expects.
function normalize(content, fallbackTitle) {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1]?.trim() || fallbackTitle
  return [{ title, summary: content.trim() }]
}

function getFallbackInsights(context, isEmployeeScope) {
  if (isEmployeeScope) return employeeInsights(context)
  if (context.moduleWorkflow?.module === 'executive') {
    const exec = context.executiveMetrics || context.moduleMetrics || context
    return dashboardInsights({
      workforce: exec.workforce,
      departments: exec.departments,
      activeWorkflows: exec.activeWorkflows || [],
      succession: exec.succession,
      recognition: exec.recognition,
    })
  }
  return context.moduleWorkflow ? (moduleInsights(context) || dashboardInsights(context)) : dashboardInsights(context)
}

// ------------------------------ Development Plan API ------------------------

/**
 * Generate AI-powered Skill Gap Development Plan.
 * Analyzes an employee's role, department, recorded competency gaps, and available catalog courses.
 *
 * @param {object} params
 * @param {object} params.employee
 * @param {Array<object>} params.gaps
 * @param {Array<object>} params.resources
 * @returns {Promise<object>} Structured AI development plan
 */
export async function generateDevelopmentPlan({ employee, gaps = [], resources = [] }) {
  const empName = employee?.full_name || 'Logistics Employee'
  const dept = employee?.department || 'Operations'
  const role = employee?.job_title || 'Staff'

  // If no API key or on error, deterministic template fallback
  const fallbackPlan = () => {
    const gapList = gaps.map(g => {
      const match = resources.find(r => (r.competencies || []).some(c => c.toLowerCase() === g.competency.toLowerCase()))
      return {
        competency: g.competency,
        currentScore: g.score,
        requiredScore: g.required_score,
        gapPoints: g.gap,
        priority: g.gap >= 10 ? 'High' : 'Medium',
        impact: `Directly impacts ${dept} quality standards and customer service expectations for ${role}.`,
        actionSteps: [
          `Complete targeted module: ${match ? `"${match.title}"` : `${g.competency} Foundational Training`}.`,
          `Practical on-the-floor application and supervisor observation in ${dept}.`,
          `Post-training reassessment to achieve benchmark (${g.required_score}% target).`
        ],
        recommendedCourse: match ? match.title : 'Internal Logistics SOP Refresher',
      }
    })

    return {
      employeeName: empName,
      department: dept,
      jobTitle: role,
      summary: `Targeted capability development plan specifically formulated for ${empName} (${role} · ${dept}) to close ${gaps.length} identified competency gap(s).`,
      overview: `Based on current evaluation records, ${empName} demonstrates baseline operational performance. Addressing the detected gaps will align service delivery with departmental standards.`,
      gapPlans: gapList,
      timelineWeeks: Math.max(2, gaps.length * 2),
      supervisorNotes: `Supervisor should schedule weekly 15-minute check-ins to monitor study progress and verify practical competency application.`,
    }
  }

  if (!config.openRouterApiKey || !gaps.length) {
    return fallbackPlan()
  }

  try {
    const promptGaps = gaps.map(g => `- ${g.competency}: Current Score ${g.score}%, Target ${g.required_score}% (Deficit: -${g.gap}%)`).join('\n')
    const promptCourses = resources.slice(0, 10).map(r => `- ${r.title} (Competencies: ${(r.competencies || []).join(', ')})`).join('\n')

    const systemPrompt = `You are an executive Logistics HR Development Specialist for a freight and logistics organization.
You analyze skill gaps and generate actionable, tailored employee development plans strictly aligned with the employee's job title and department.
Return ONLY valid JSON with no extra commentary or markdown fencing.`

    const userPrompt = `Generate an AI Development Plan for:
Employee: ${empName}
Role: ${role}
Department: ${dept}

Detected Skill Gaps:
${promptGaps}

Available Learning Resources Catalog:
${promptCourses}

Return a JSON object with this exact structure:
{
  "employeeName": "${empName}",
  "department": "${dept}",
  "jobTitle": "${role}",
  "summary": "Short 2-sentence executive summary of the plan",
  "overview": "Context on how closing these gaps enhances performance in ${dept}",
  "timelineWeeks": 4,
  "gapPlans": [
    {
      "competency": "Name of competency",
      "currentScore": 70,
      "requiredScore": 85,
      "gapPoints": 15,
      "priority": "High | Medium | Low",
      "impact": "Specific reason why this gap matters for a ${role} in ${dept}",
      "actionSteps": [
        "Step 1: Specific learning/study action",
        "Step 2: Practical daily operational exercise",
        "Step 3: Verification or assessment milestone"
      ],
      "recommendedCourse": "Title of best matching course from catalog"
    }
  ],
  "supervisorNotes": "Key recommendation for the supervisor"
}`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openRouterApiKey}`,
        'HTTP-Referer': config.clientOrigin,
        'X-Title': 'Priority Handling Services, Inc.',
      },
      body: JSON.stringify({
        model: config.openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    })

    if (!response.ok) throw new Error(`OpenRouter failed: ${response.status}`)
    const payload = await response.json()
    const raw = payload?.choices?.[0]?.message?.content || ''
    
    // Parse JSON safely
    const cleanJson = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleanJson)
    return parsed
  } catch (err) {
    console.warn('[openrouter] Error generating AI development plan, falling back:', err.message)
    return fallbackPlan()
  }
}

// ------------------------------ Public Analytics Insights API ---------------

/**
 * Generate analytics insights.
 *
 * @param {object} context - Context object assembled by the analytics route.
 * @returns {Promise<Array<{title: string, summary: string}>>} Insights array.
 */
export async function generateInsights(context) {
  const isEmployeeScope = Boolean(context.employeeMetrics && context.moduleWorkflow?.scope === 'employee-specific')

  if (!config.openRouterApiKey) {
    return getFallbackInsights(context, isEmployeeScope)
  }

  try {
    const fallbackTitle = context.moduleWorkflow
      ? (isEmployeeScope
          ? `${context.employeeMetrics?.employee_name || 'Employee'} — Personal AI Insight`
          : `${context.moduleWorkflow.module[0].toUpperCase()}${context.moduleWorkflow.module.slice(1)} Management Report`)
      : context.employee
        ? 'Employee HR Analytics Report'
        : 'Executive HR Analytics Report'
    const content = await callOpenRouter(context)
    return normalize(content, fallbackTitle)
  } catch (error) {
    console.warn('[openrouter] Falling back to template insights:', error.message)
    return getFallbackInsights(context, isEmployeeScope)
  }
}

/**
 * Generate AI-assisted Succession Planning Assessment and Critical Role Recommendation.
 * Compares current employee profile with actual system target positions.
 * AI is strictly restricted to recommending from the provided list of system positions.
 */
export async function generateAiSuccessionRecommendation({
  employee,
  readinessScore,
  readinessBand,
  performanceHistory = [],
  competencyAssessments = [],
  competencyGaps = [],
  completedLearning = [],
  trainingHistory = [],
  targetPositions = [],
}) {
  if (!config.openRouterApiKey) {
    throw new Error('OpenRouter API key is not configured; using deterministic fallback.')
  }

  const validTitles = targetPositions.map(p => p.title)
  if (!validTitles.length) {
    throw new Error('No target positions provided for succession comparison.')
  }

  const positionsSummary = targetPositions.map(p => {
    const reqs = (p.required_competencies || []).map(c => `${c.competency} (Req: ${c.requiredScore}%)`).join(', ')
    const learn = (p.required_learning || []).join(', ')
    return `- Title: "${p.title}" | Dept: ${p.department} | Critical Role: ${p.is_critical ? 'YES' : 'NO'} | Required Competencies: [${reqs}] | Required Learning: [${learn}]`
  }).join('\n')

  const employeeComps = competencyAssessments.map(c => `- ${c.competency}: Current Score ${c.score}% (Benchmark: ${c.required_score}%)`).join('\n')
  const learningSummary = completedLearning.map(l => `- ${l.title} (${l.category || 'General'})`).join('\n')
  const trainingSummary = trainingHistory.map(t => `- ${t.title} (${t.attendance || 'Attended'})`).join('\n')

  const systemPrompt = `You are an executive Logistics HR Succession Planning Specialist for a modern freight and logistics group.
Your duty is to analyze employee capability evidence and recommend a NEXT POSITION or CRITICAL ROLE from actual authorized target roles.

CRITICAL RULES:
1. You must NEVER invent arbitrary position titles. You must ONLY choose from the provided list of Target Positions.
2. The system has calculated the official readiness score (${readinessScore}%, ${readinessBand}). Do NOT replace or contradict this score.
3. Compare the employee's current profile against the target position requirements to provide explainable matching and missing competencies.
4. Return ONLY valid JSON with no markdown wrapping or extra prose.`

  const userPrompt = `Evaluate this employee for succession and recommend the best next position:

EMPLOYEE PROFILE:
- Name: ${employee.fullName} (ID: ${employee.employeeNumber})
- Current Position: ${employee.jobTitle}
- Department: ${employee.department}
- Official Readiness Score: ${readinessScore}% (${readinessBand})
- Performance Score: ${employee.performanceScore}%
- Competency Score: ${employee.competencyScore}%
- Learning Progress: ${employee.learningProgress}%

COMPETENCY ASSESSMENTS:
${employeeComps || 'No individual competencies recorded.'}

COMPLETED LEARNING MODULES:
${learningSummary || 'No completed learning modules recorded.'}

TRAINING PARTICIPATION:
${trainingSummary || 'No formal training participation recorded.'}

AVAILABLE TARGET SYSTEM POSITIONS (Choose strictly from this list):
${positionsSummary}

Return a JSON object with this exact structure:
{
  "readinessAssessment": "A 2-3 sentence executive assessment of the employee's succession readiness.",
  "strengths": [
    "Key strength 1 with data point",
    "Key strength 2 with data point"
  ],
  "developmentGaps": [
    "Key competency or capability gap to address"
  ],
  "recommendedPosition": "Exact title chosen from the provided target positions",
  "recommendationReason": "Clear explainable reason why this specific position fits the candidate",
  "matchingCompetencies": [
    "Competency where employee meets or exceeds requirement"
  ],
  "missingCompetencies": [
    "Competency where employee trails the target role requirement"
  ],
  "developmentRecommendations": [
    "Actionable development recommendation 1",
    "Actionable development recommendation 2"
  ]
}`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'HTTP-Referer': config.clientOrigin,
      'X-Title': 'Priority Handling Services, Inc.',
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`)
  const data = await response.json()
  const raw = data?.choices?.[0]?.message?.content || ''
  const cleanJson = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleanJson)

  // Strict validation: recommendedPosition must be in validTitles
  if (parsed.recommendedPosition && !validTitles.some(t => t.toLowerCase() === parsed.recommendedPosition.toLowerCase())) {
    console.warn(`[openrouter] AI suggested "${parsed.recommendedPosition}" which is not in target positions list.`)
    parsed.recommendedPosition = null
  }

  return parsed
}



