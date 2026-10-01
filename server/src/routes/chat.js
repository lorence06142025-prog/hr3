import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'
import { config } from '../config.js'

const router = Router()
router.use(authenticate)

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
})

// Department -> Allowed Competencies Map for strict RBAC domain integrity
const DEPARTMENT_COMPETENCY_ALLOWLIST = {
  'Front Office': ['Customer Service', 'Communication', 'Conflict Resolution', 'Reservation Management', 'Upselling', 'Teamwork', 'Compliance', 'Leadership'],
  'Housekeeping': ['Housekeeping Standards', 'Compliance', 'Teamwork', 'Customer Service', 'Communication', 'Leadership', 'Operational Standards'],
  'Kitchen': ['Kitchen Operations', 'Food Safety', 'Compliance', 'Teamwork', 'Leadership', 'Technical Skills'],
  'Food & Beverage': ['Customer Service', 'Food Safety', 'Upselling', 'Communication', 'Teamwork', 'Conflict Resolution', 'Compliance', 'Leadership'],
  'Human Resources': ['Compliance', 'Communication', 'Conflict Resolution', 'Leadership', 'Teamwork', 'Operational Management'],
  'Operations': ['Operational Management', 'Financial Acumen', 'Leadership', 'Communication', 'Compliance', 'Customer Service', 'Teamwork'],
  'Executive Office': ['Operational Management', 'Financial Acumen', 'Leadership', 'Communication', 'Compliance', 'Customer Service', 'Teamwork'],
}

function isCompetencyAllowedForDepartment(comp, dept) {
  if (!dept || !DEPARTMENT_COMPETENCY_ALLOWLIST[dept]) return true
  return DEPARTMENT_COMPETENCY_ALLOWLIST[dept].some(allowed => allowed.toLowerCase() === (comp || '').toLowerCase())
}

/**
 * AI CHAT DATA PIPELINE & RBAC ENGINE
 * 
 * Pipeline:
 * User Question -> Authentication -> RBAC Check -> Determine Scope -> 
 * Retrieve Database Data -> Send Structured Data to AI -> Grounded Answer
 */
router.post('/', async (req, res, next) => {
  try {
    const { message, history } = chatSchema.parse(req.body || {})
    const { id: userId, role, employeeId } = req.user
    const textLower = message.toLowerCase()

    // -------------------------------------------------------------------------
    // STEP 1 & 2: RBAC CHECK & SCOPE DETERMINATION
    // -------------------------------------------------------------------------
    let userDepartment = null
    let employeeProfile = null

    if (employeeId) {
      try {
        const empRes = await query(
          'SELECT id, full_name, job_title, department, performance_score, competency_score, learning_progress FROM employees WHERE id=$1',
          [employeeId]
        )
        employeeProfile = empRes.rows[0] || null
        userDepartment = employeeProfile?.department || null
      } catch (err) {
        console.warn('[chat-route] Could not load user employee profile:', err.message)
      }
    }

    const DEPARTMENT_KEYWORDS = [
      { name: 'Front Office', keywords: ['front office'] },
      { name: 'Housekeeping', keywords: ['housekeeping'] },
      { name: 'Kitchen', keywords: ['kitchen department', 'kitchen team', 'culinary department', 'kitchen staff'] },
      { name: 'Food & Beverage', keywords: ['food & beverage', 'food and beverage', 'f&b department', 'restaurant department'] },
      { name: 'Human Resources', keywords: ['human resources department', 'hr department'] },
      { name: 'Operations', keywords: ['operations department'] },
      { name: 'Executive Office', keywords: ['executive office department', 'executive office'] },
    ]

    // Fetch all active employees for cross-department name verification
    const allEmpsRes = await query('SELECT id, full_name, department FROM employees WHERE is_active = true').catch(() => ({ rows: [] }))
    const allSystemEmployees = allEmpsRes.rows || []

    const isExplicitSelfDepartmentQuery = (
      textLower.includes('my department') ||
      textLower.includes('my team') ||
      textLower.includes('under my') ||
      textLower.includes('in my department') ||
      textLower.includes('our department') ||
      textLower.includes('our team') ||
      (userDepartment && textLower.includes(userDepartment.toLowerCase()))
    )

    // -------------------------------------------------------------------------
    // STEP 1.1: RBAC SCOPE GUARD - EMPLOYEE ROLE
    // -------------------------------------------------------------------------
    if (role === 'employee') {
      const isCoworkerQuery = (
        textLower.includes('coworker') ||
        textLower.includes('colleague') ||
        textLower.includes('other employee') ||
        textLower.includes('highest performance') ||
        textLower.includes('top employee') ||
        textLower.includes('who had') ||
        textLower.includes('everyone') ||
        textLower.includes('organization') ||
        textLower.includes('department average') ||
        textLower.includes('team roster') ||
        textLower.includes('all employees') ||
        textLower.includes('my department') ||
        textLower.includes('under my department')
      )

      const mentionedAnyDept = DEPARTMENT_KEYWORDS.some(d => d.keywords.some(k => textLower.includes(k)))
      const otherEmployee = allSystemEmployees.find(e => {
        if (e.id === employeeId) return false
        const nameLower = e.full_name.toLowerCase()
        const nameParts = nameLower.split(' ').filter(p => p.length >= 3)
        if (textLower.includes(nameLower)) return true
        if (nameParts.length >= 2 && nameParts.every(p => textLower.includes(p))) return true
        return false
      })

      if (isCoworkerQuery || mentionedAnyDept || otherEmployee) {
        const targetDesc = otherEmployee
          ? `records for **${otherEmployee.full_name}**`
          : 'departmental and peer records'
        return res.json({
          answer: `Sorry, that is not part of your authorized scope. As an **Employee**, you are authorized to view only your own personal performance, competency, and learning records.\n\nAccess to ${targetDesc} is restricted to Supervisors and HR/Management.`,
          dataContextSummary: 'Access Restricted — Scope Boundary Enforced',
          grounded: true,
        })
      }
    }

    // -------------------------------------------------------------------------
    // STEP 1.2: RBAC SCOPE GUARD - SUPERVISOR & OPERATIONS MANAGER ROLES
    // -------------------------------------------------------------------------
    const isSupervisorOrOpManager = role === 'supervisor' || role === 'operations_manager'
    if (isSupervisorOrOpManager) {
      if (!userDepartment) {
        return res.status(403).json({ error: 'Your account requires an assigned department to use the AI assistant.' })
      }

      // Check if user explicitly asks about a different department
      const mentionedOtherDept = DEPARTMENT_KEYWORDS.find(d => 
        d.name.toLowerCase() !== userDepartment.toLowerCase() &&
        d.keywords.some(k => textLower.includes(k))
      )

      if (mentionedOtherDept) {
        return res.json({
          answer: `Sorry, that is not part of your authorized scope. As a **${role === 'supervisor' ? 'Supervisor' : 'Operations Manager'}** for the **${userDepartment}** Department, your access is strictly restricted to **${userDepartment}** personnel and operations.\n\nViewing records or employees for the **${mentionedOtherDept.name}** Department is restricted to authorized department supervisors and HR/Management.`,
          dataContextSummary: 'Access Restricted — Scope Boundary Enforced',
          grounded: true,
        })
      }

      // Check if user is asking about a specific employee in another department
      const otherDeptEmployee = allSystemEmployees.find(e => {
        if (e.department.toLowerCase() === userDepartment.toLowerCase()) return false
        const nameLower = e.full_name.toLowerCase()
        const nameParts = nameLower.split(' ').filter(p => p.length >= 3)
        if (textLower.includes(nameLower)) return true
        if (nameParts.length >= 2 && nameParts.every(p => textLower.includes(p))) return true
        return false
      })

      if (otherDeptEmployee) {
        return res.json({
          answer: `Sorry, that is not part of your authorized scope. **${otherDeptEmployee.full_name}** belongs to the **${otherDeptEmployee.department}** Department.\n\nAs a **${role === 'supervisor' ? 'Supervisor' : 'Operations Manager'}** for **${userDepartment}**, you are only authorized to view records and insights for employees within the **${userDepartment}** Department.`,
          dataContextSummary: 'Access Restricted — Scope Boundary Enforced',
          grounded: true,
        })
      }

      // Check if user is asking for hotel-wide or organization-wide rosters (excluding queries for their own department/team)
      const isOrgWideQuery = !isExplicitSelfDepartmentQuery && (
        textLower.includes('all department') ||
        textLower.includes('all departments') ||
        textLower.includes('every department') ||
        textLower.includes('all hotel employees') ||
        textLower.includes('all employees in the hotel') ||
        textLower.includes('all employees in the organization') ||
        textLower.includes('entire hotel') ||
        textLower.includes('organization average') ||
        textLower.includes('hotel roster') ||
        textLower.includes('whole company')
      )

      if (isOrgWideQuery) {
        return res.json({
          answer: `Sorry, that is not part of your authorized scope. As a **${role === 'supervisor' ? 'Supervisor' : 'Operations Manager'}**, your access is restricted to the **${userDepartment}** Department.\n\nOrganization-wide analytics and cross-department rosters are restricted to HR and Senior Management.`,
          dataContextSummary: 'Access Restricted — Scope Boundary Enforced',
          grounded: true,
        })
      }
    }

    // -------------------------------------------------------------------------
    // STEP 3: DATABASE DATA RETRIEVAL (EXACT TABLE COLUMN SCHEMA)
    // -------------------------------------------------------------------------
    let employeeWhere = ''
    let queryParams = []

    if (role === 'employee') {
      employeeWhere = ' WHERE e.id = $1 '
      queryParams = [employeeId]
    } else if (isSupervisorOrOpManager) {
      employeeWhere = ' WHERE e.department = $1 '
      queryParams = [userDepartment]
    } else {
      // HR or Management — organization-wide
      employeeWhere = ' WHERE e.is_active = true '
      queryParams = []
    }

    const subWhereClause = role === 'employee' ? ' WHERE e.id = $1 ' : isSupervisorOrOpManager ? ' WHERE e.department = $1 ' : ''
    const subQueryParams = role === 'employee' ? [employeeId] : isSupervisorOrOpManager ? [userDepartment] : []

    // Safely query all database tables matching exact migrations schema
    // Training-specific scope: employees can only see their own training
    const trainingEmpJoin = role === 'employee'
      ? ' JOIN training_participants tp ON tp.session_id = ts.id AND tp.employee_id = $1'
      : isSupervisorOrOpManager
      ? ` AND (ts.department = $1 OR ts.department = 'All Departments')`
      : ''
    const trainingParams = role === 'employee' ? [employeeId] : isSupervisorOrOpManager ? [userDepartment] : []
    const trainingWhere = role === 'employee' ? 'WHERE 1=1' : 'WHERE 1=1'

    const [{ rows: employees }, { rows: gaps }, { rows: assignments }, { rows: resources }, { rows: succession }, { rows: trainingSessions }, { rows: trainingParticipants }] = await Promise.all([
      query(`
        SELECT e.id, e.full_name, e.job_title, e.department, e.performance_score, e.competency_score, e.learning_progress 
        FROM employees e
        ${employeeWhere}
        ORDER BY e.performance_score DESC
      `, queryParams).catch(() => ({ rows: [] })),
      
      query(`
        SELECT ca.competency, ca.score, ca.required_score, (ca.required_score - ca.score) AS gap,
               e.full_name, e.department
        FROM competency_assessments ca
        JOIN employees e ON ca.employee_id = e.id
        ${subWhereClause}
        ORDER BY gap DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      query(`
        SELECT lr.title AS resource_title, la.status, la.progress, (la.status = 'completed' OR la.progress >= 100) AS is_completed, la.due_date,
               e.full_name, e.department
        FROM learning_assignments la
        JOIN learning_resources lr ON la.resource_id = lr.id
        JOIN employees e ON la.employee_id = e.id
        ${subWhereClause}
        ORDER BY la.assigned_at DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      query(`
        SELECT id, title, category, duration_hours, provider
        FROM learning_resources
        WHERE is_active = true
        ORDER BY title ASC
      `).catch(() => ({ rows: [] })),

      query(`
        SELECT sp.readiness_band, sp.readiness_score, e.full_name, e.department, e.job_title
        FROM succession_profiles sp
        JOIN employees e ON sp.employee_id = e.id
        ${subWhereClause}
        ORDER BY sp.readiness_score DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      // Training Management: formal instructor-led sessions (separate from learning)
      query(
        role === 'employee'
          ? `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               tp.attendance, tp.evaluation_score
             FROM training_sessions ts
             JOIN training_participants tp ON tp.session_id = ts.id
             WHERE tp.employee_id = $1
             ORDER BY ts.start_date DESC LIMIT 20`
          : isSupervisorOrOpManager
          ? `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               COUNT(tp.id)::int AS total_invited,
               COUNT(tp.id) FILTER (WHERE tp.attendance IN ('present','late'))::int AS attended,
               COUNT(tp.id) FILTER (WHERE tp.attendance = 'absent')::int AS absent
             FROM training_sessions ts
             LEFT JOIN training_participants tp ON tp.session_id = ts.id
             WHERE (ts.department = $1 OR ts.department = 'All Departments')
             GROUP BY ts.id ORDER BY ts.start_date DESC LIMIT 20`
          : `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               COUNT(tp.id)::int AS total_invited,
               COUNT(tp.id) FILTER (WHERE tp.attendance IN ('present','late'))::int AS attended,
               COUNT(tp.id) FILTER (WHERE tp.attendance = 'absent')::int AS absent
             FROM training_sessions ts
             LEFT JOIN training_participants tp ON tp.session_id = ts.id
             GROUP BY ts.id ORDER BY ts.start_date DESC LIMIT 30`,
        trainingParams
      ).catch(() => ({ rows: [] })),

      // Training participants summary (for HR/manager)
      role !== 'employee'
        ? query(
            isSupervisorOrOpManager
              ? `SELECT e.full_name, e.department, ts.title AS session_title, tp.attendance, tp.evaluation_score
                 FROM training_participants tp
                 JOIN employees e ON e.id = tp.employee_id
                 JOIN training_sessions ts ON ts.id = tp.session_id
                 WHERE e.department = $1
                 ORDER BY ts.start_date DESC LIMIT 40`
              : `SELECT e.full_name, e.department, ts.title AS session_title, tp.attendance, tp.evaluation_score
                 FROM training_participants tp
                 JOIN employees e ON e.id = tp.employee_id
                 JOIN training_sessions ts ON ts.id = tp.session_id
                 ORDER BY ts.start_date DESC LIMIT 40`,
            isSupervisorOrOpManager ? [userDepartment] : []
          ).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ])

    // Calculate aggregated metrics for grounded context
    const avgPerf = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.performance_score) || 0), 0) / employees.length) : 0
    const avgComp = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.competency_score) || 0), 0) / employees.length) : 0
    const avgLearn = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.learning_progress) || 0), 0) / employees.length) : 0
    const readyNowCount = succession.filter(s => s.readiness_band === 'ready_now').length
    const completedTrainings = trainingSessions.filter(ts => ts.status === 'completed').length
    const scheduledTrainings = trainingSessions.filter(ts => ts.status === 'scheduled').length

    // Filter competency gaps strictly by department relevance
    const filteredGaps = gaps.filter(g => isCompetencyAllowedForDepartment(g.competency, g.department))

    const dataContext = {
      userRole: role,
      userScope: role === 'employee' ? 'self_only' : isSupervisorOrOpManager ? `department_${userDepartment}` : 'organization_wide',
      currentUser: employeeProfile ? employeeProfile.full_name : 'System User',
      metrics: {
        totalEmployees: employees.length,
        averagePerformance: avgPerf,
        averageCompetency: avgComp,
        averageLearningProgress: avgLearn,
        successionReadyNowCount: readyNowCount,
        totalLearningResources: resources.length,
        totalTrainingSessions: trainingSessions.length,
        completedTrainingSessions: completedTrainings,
        scheduledTrainingSessions: scheduledTrainings,
      },
      employees: employees.map(e => ({
        name: e.full_name,
        role: e.job_title,
        department: e.department,
        performanceScore: `${e.performance_score}%`,
        competencyScore: `${e.competency_score}%`,
        learningProgress: `${e.learning_progress}%`,
      })),
      topCompetencyGaps: filteredGaps.slice(0, 10).map(g => ({
        employee: g.full_name,
        competency: g.competency,
        currentScore: `${g.score}%`,
        targetScore: `${g.required_score}%`,
        gap: `${g.gap}%`,
        department: g.department,
      })),
      incompleteLearningActivities: assignments.filter(a => !a.is_completed).map(a => ({
        employee: a.full_name,
        course: a.resource_title,
        progress: `${a.progress}%`,
        status: a.status,
        department: a.department,
      })),
      learningResourcesLibrary: resources.map(r => ({
        title: r.title,
        category: r.category,
        durationHours: r.duration_hours,
        provider: r.provider || 'Internal',
      })),
      successionPipeline: succession.map(s => ({
        employee: s.full_name,
        jobTitle: s.job_title,
        department: s.department,
        readinessBand: s.readiness_band,
        readinessScore: `${s.readiness_score}%`,
      })),
      // TRAINING MANAGEMENT: Instructor-led formal training sessions (NOT the same as Learning)
      trainingSessions: trainingSessions.map(ts => ({
        title: ts.title,
        category: ts.category,
        trainer: ts.trainer || 'TBD',
        venue: ts.venue,
        startDate: ts.start_date,
        endDate: ts.end_date,
        status: ts.status,
        department: ts.department,
        ...(role === 'employee'
          ? { myAttendance: ts.attendance, myEvaluationScore: ts.evaluation_score }
          : { totalInvited: ts.total_invited, attended: ts.attended, absent: ts.absent }),
      })),
      trainingParticipantRecords: trainingParticipants.slice(0, 30).map(tp => ({
        employee: tp.full_name,
        department: tp.department,
        session: tp.session_title,
        attendance: tp.attendance,
        evaluationScore: tp.evaluation_score,
      })),
    }

    // Filter conversation history to avoid duplicating current user message
    const filteredHistory = history
      .filter(h => !(h.role === 'user' && h.content === message))
      .slice(-4)

    // -------------------------------------------------------------------------
    // STEP 4: AI GENERATION WITH STRICT GROUNDING IN DATABASE DATA
    // -------------------------------------------------------------------------
    let answerText = ''

    if (config.openRouterApiKey) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openRouterApiKey}`,
            'HTTP-Referer': config.clientOrigin,
            'X-Title': 'PerDevSys AI Assistant',
          },
          body: JSON.stringify({
            model: config.openRouterModel,
            messages: [
              {
                role: 'system',
                content: `You are the executive and operational AI Assistant for PerDevSys (Performance & Capability Development System).
STRICT GROUNDING & QUALITY RULES:
1. You MUST ONLY answer using the authorized database records provided in the context below.
2. NEVER fabricate employee names, performance scores, courses, competency gaps, training sessions, or numbers.
3. If data is not present in the provided JSON context, explicitly state: "Based on available system records, that information is not recorded in the database."
4. Always respect the user's role (${dataContext.userRole}) and authorized scope (${dataContext.userScope}).
5. Distinguish between current scores and target scores when explaining competency gaps.
6. PROVIDE COMPREHENSIVE, IN-DEPTH, STRUCTURED RESPONSES:
   - When asked for suggestions, advice, or recommendations (e.g. "as a supervisor, what can you suggest on giving them learning courses?", "how to improve my team", "what learning courses to assign"):
     a) Address the user directly in their role (e.g. "As a Supervisor...", "As a Department Head...") with thoughtful managerial insights.
     b) Provide an overview of current team metrics (Performance, Competency, Learning Completion, Active Gaps).
     c) For each employee, break down their specific competency gaps, current in-progress courses, and exact matching courses from 'learningResourcesLibrary' (including title, hours, provider).
     d) If a gap does not have a matching course in the library, state that explicitly.
     e) Conclude with structured, actionable supervisory next steps (e.g. course assignment, progress follow-up, milestone check-ins).
   - Format cleanly with professional Markdown (clear headings, bullet lists, bold highlights).
   - NEVER provide brief, lazy one-line summaries when asked for guidance or capability analysis.
7. Always format bold headings, action labels, and item titles using double asterisks (e.g. **Action Steps**, **Identify Learning Needs:**).
8. When the user asks to list or show employees (e.g. "list employees under my department", "who are my department employees", "list employees"), list each employee individually with their full name, job title, department, performance score, competency score, and learning progress, plus summary averages. Do NOT summarize into just a total count.
9. When the user asks for learning recommendations, provide per-employee recommendations STRICTLY grounded in the provided data:
   - For each employee in the 'employees' array, check 'topCompetencyGaps' for their recorded gaps and 'incompleteLearningActivities' for courses they already have assigned but haven't finished.
   - Only recommend courses that LITERALLY EXIST in 'learningResourcesLibrary'. NEVER invent a course name, title, or provider.
   - If a gap exists but no matching resource is found in the library, say so explicitly (e.g. "No matching resource currently available in the library for this gap").
   - If an employee has no gap records and no incomplete activities, say so — do NOT invent generic advice or make up focus areas.
   - Format: one section per employee as a markdown heading, with bullet points for each recommendation.
10. When the user asks about a SPECIFIC EMPLOYEE (e.g. "what are your insights about Maria Lopez?", "tell me about Maria Lopez", "how is Maria doing?", "status of Maria", "Maria Lopez performance"):
    - Locate the employee in the 'employees' array.
    - Provide a complete individual capability and performance profile:
      a) Performance & Capability Snapshot (Name, Role, Department, Performance Score, Competency Score, Learning Progress, Succession Band)
      b) Key Supervisory Insights & Capability Assessment (strengths, skill gaps, learning activity status, training participation)
      c) Grounded Course Recommendations (matched from 'learningResourcesLibrary' for any gaps)
      d) Actionable Supervisory Recommendations / Coaching Next Steps.
    - NEVER return a generic department summary when a specific person is asked about!
11. STRICT DEPARTMENT RBAC & DOMAIN RELEVANCE:
    - Every recommendation, insight, skill gap, and course suggestion MUST belong strictly to the employee's department and job role.
    - For Front Office staff (e.g. Receptionist, Concierge, Front Desk), ONLY discuss Front Office competencies and courses (Customer Service, Communication, Conflict Resolution, Reservation Management, Upselling, Teamwork, Compliance, Leadership).
    - NEVER suggest Kitchen Operations or Food Safety to Front Office or Housekeeping staff.
    - NEVER suggest Front Desk or Reservation courses to Kitchen staff.
    - Respect department authorization and operational scope at all times.
12. WHEN THE USER IS AN EMPLOYEE (userScope: 'self_only' / role: 'employee'):
    - Always address the employee personally and directly (e.g. "Based on your official system records...", "Your personal performance rating...").
    - NEVER use managerial or supervisory headings (such as "Supervisory Overview", "Monitored Team Members", "Overseeing Your Scope", "Your Team").
    - Frame all answers as personal capability growth, skill improvement, and course completion steps.

CRITICAL MODULE DISAMBIGUATION — READ CAREFULLY:
- "Training Management" or "Training" refers EXCLUSIVELY to formal, instructor-led training sessions (found in the 'trainingSessions' key of the context). These are scheduled events with trainers, venues, dates, and attendance tracking.
- "Learning" or "Learning Management" refers EXCLUSIVELY to self-paced digital learning assignments and resources (found in the 'incompleteLearningActivities' and 'learningResourcesLibrary' keys).
- When the user asks about training, workshops, sessions, attendance, or trainers → use ONLY data from 'trainingSessions' and 'trainingParticipantRecords'.
- When the user asks about learning, e-learning, courses, course completion, or learning progress → use ONLY data from 'incompleteLearningActivities' and 'learningResourcesLibrary'.
- NEVER mix training session data with learning resource data in the same answer unless explicitly asked to compare them.`
              },
              {
                role: 'system',
                content: `AUTHORIZED DATABASE CONTEXT (JSON):\n${JSON.stringify(dataContext, null, 2)}`
              },
              ...filteredHistory,
              { role: 'user', content: message }
            ],
            temperature: 0.2,
            max_tokens: 1800,
          }),
        })

        if (response.ok) {
          const payload = await response.json()
          answerText = payload?.choices?.[0]?.message?.content || ''
        } else {
          console.warn('[chat-route] OpenRouter status:', response.status, await response.text().catch(() => ''))
        }
      } catch (llmErr) {
        console.warn('[chat-route] OpenRouter API call failed, using deterministic grounding:', llmErr.message)
      }
    }

    // Fallback Grounded Generator (when API key is absent, invalid, or offline)
    if (!answerText) {
      answerText = generateGroundedFallback(message, dataContext)
    }

    res.json({
      answer: answerText,
      dataContextSummary: `${dataContext.employees.length} employee record(s) in scope (${dataContext.userScope})`,
      grounded: true,
    })

  } catch (error) {
    console.error('[chat-route-error]', error)
    next(error)
  }
})

/**
 * Deterministic Grounded Generator for offline / demo environments
 */
function generateGroundedFallback(prompt, ctx) {
  const p = prompt.toLowerCase()
  const empList = ctx.employees || []
  const allGaps = ctx.topCompetencyGaps || []
  // Enforce strict department RBAC filtering on competency gaps
  const gaps = allGaps.filter(g => isCompetencyAllowedForDepartment(g.competency, g.department))
  const learning = ctx.incompleteLearningActivities || []
  const resources = ctx.learningResourcesLibrary || []
  const succession = ctx.successionPipeline || []
  const trainings = ctx.trainingSessions || []
  const trainingParticipants = ctx.trainingParticipantRecords || []

  const isSelfScope = ctx.userRole === 'employee' || ctx.userScope === 'self_only'

  const roleTitle = ctx.userRole === 'supervisor'
    ? 'Supervisor'
    : ctx.userRole === 'operations_manager'
    ? 'Department Head / Operations Manager'
    : ctx.userRole === 'hr_admin'
    ? 'HR Administrator'
    : ctx.userRole === 'employee'
    ? 'Employee'
    : 'Manager'

  const scopeName = ctx.userScope.startsWith('department_')
    ? `the ${ctx.userScope.replace('department_', '').toUpperCase()} Department`
    : ctx.userScope === 'self_only'
    ? 'Your Personal Scope'
    : 'the Entire Organization'

  // 0. Specific Individual Employee Inquiry (e.g. "insights about Maria Lopez", "tell me about Maria Lopez", "Maria Lopez status")
  const matchedEmployee = empList.find(e => {
    const fullNameLower = e.name.toLowerCase()
    const nameParts = fullNameLower.split(' ').filter(part => part.length >= 2)
    // Full name match (e.g. "maria lopez")
    if (p.includes(fullNameLower)) return true
    // Both first and last names present
    if (nameParts.length >= 2 && nameParts.every(part => p.includes(part))) return true
    // Single name part with inquiry intent keywords (e.g. "maria", "lopez")
    if (nameParts.length >= 1 && nameParts.some(part => {
      if (part.length < 3) return false
      const inquiryKeywords = ['about', 'insight', 'status', 'score', 'gap', 'performance', 'who is', 'how is', 'tell me', 'profile', 'progress', 'recommendation for', 'suggest for', 'details of', 'evaluat']
      return p.includes(part) && inquiryKeywords.some(k => p.includes(k))
    })) {
      return true
    }
    return false
  })

  if (matchedEmployee && !isSelfScope) {
    const empGaps = gaps.filter(g => g.employee && g.employee.toLowerCase() === matchedEmployee.name.toLowerCase())
    const empIncomplete = learning.filter(l => l.employee && l.employee.toLowerCase() === matchedEmployee.name.toLowerCase())
    const empSuccession = succession.find(s => s.employee && s.employee.toLowerCase() === matchedEmployee.name.toLowerCase())
    const empTrainings = trainingParticipants.filter(tp => tp.employee && tp.employee.toLowerCase() === matchedEmployee.name.toLowerCase())

    const perfNum = parseFloat(matchedEmployee.performanceScore) || 0
    const perfRating = perfNum >= 90
      ? 'Outstanding (Top Tier Performance)'
      : perfNum >= 80
      ? 'Strong (Meets Operational Standards)'
      : perfNum >= 70
      ? 'Satisfactory (Developing Core Competence)'
      : 'Needs Improvement (Priority Coaching Required)'

    const successionInfo = empSuccession
      ? (empSuccession.readinessBand === 'ready_now'
          ? `**Ready Now** (Immediate Leadership/Role Candidate · Readiness Score: **${empSuccession.readinessScore}**)`
          : empSuccession.readinessBand === 'ready_1_2_years'
          ? `**Ready in 1–2 Years** (High Potential Pipeline · Readiness Score: **${empSuccession.readinessScore}**)`
          : `**Developing** (Readiness Score: **${empSuccession.readinessScore}**)`)
      : 'Not currently listed in succession pipeline assessments.'

    const lines = [
      `### 👤 Employee Insights & Capability Profile: **${matchedEmployee.name}**`,
      `As a **${roleTitle}** overseeing **${scopeName}**, here is a data-grounded performance, capability, and development analysis for **${matchedEmployee.name}**:\n`,
      `---`,
      `#### 1. 📊 Performance & Capability Snapshot`,
      `• **Full Name**: **${matchedEmployee.name}**`,
      `• **Role / Job Title**: **${matchedEmployee.role}** (${matchedEmployee.department})`,
      `• **Performance Score**: **${matchedEmployee.performanceScore}** — _${perfRating}_`,
      `• **Competency Rating**: **${matchedEmployee.competencyScore}**`,
      `• **Learning Progress**: **${matchedEmployee.learningProgress}** completion`,
      `• **Succession Readiness**: ${successionInfo}\n`,
      `---`,
      `#### 2. 🔍 Key Supervisory Insights & Capability Assessment`,
    ]

    // Competency Gaps & Course Recommendations
    if (empGaps.length) {
      lines.push(`• **Identified Competency Gaps & Course Matches**:`)
      empGaps.forEach(g => {
        const gapLower = g.competency.toLowerCase()
        const matchedResource = resources.find(r =>
          r.category.toLowerCase().includes(gapLower) ||
          r.title.toLowerCase().includes(gapLower)
        )
        if (matchedResource) {
          lines.push(
            `  - Gap in **${g.competency}** (Current: **${g.currentScore}** → Target: **${g.targetScore}**, Gap: **${g.gap}**)` +
            `\n    → **Recommended System Course**: **"${matchedResource.title}"** (${matchedResource.durationHours} hrs · Category: ${matchedResource.category} · Provider: ${matchedResource.provider})`
          )
        } else {
          lines.push(
            `  - Gap in **${g.competency}** (Current: **${g.currentScore}** → Target: **${g.targetScore}**, Gap: **${g.gap}**)` +
            `\n    → _Note: No matching course currently exists in the system library for "${g.competency}". Consider arranging coaching._`
          )
        }
      })
    } else {
      lines.push(`• **Competency Gaps**: No active competency gaps recorded in system assessments. Demonstrating stable capability across assessed areas.`)
    }

    // Incomplete Learning Activities
    if (empIncomplete.length) {
      lines.push(`• **Pending / Incomplete Learning Modules**:`)
      empIncomplete.forEach(l => {
        lines.push(`  - ⏳ In-Progress: **"${l.course}"** (${l.progress} completed · Status: **${l.status}**)`)
      })
    } else {
      lines.push(`• **Learning Course Status**: All assigned e-learning modules are currently up to date.`)
    }

    // Training Sessions
    if (empTrainings.length) {
      lines.push(`• **Formal Workshop / Training Attendance**:`)
      empTrainings.forEach(tp => {
        lines.push(`  - Session: **"${tp.session}"** (Attendance: **${tp.attendance || 'Attended'}** · Score: **${tp.evaluationScore ? tp.evaluationScore + '%' : 'Completed'}**)`)
      })
    }

    lines.push(
      `\n---`,
      `#### 3. 💡 Supervisory Recommendations for ${matchedEmployee.name}`,
      empGaps.length
        ? `1. **Assign Targeted Training**: Enroll ${matchedEmployee.name} in the recommended courses above to close the recorded **${empGaps.map(g => g.competency).join(', ')}** gap(s).`
        : `1. **Sustain High Performance**: Acknowledge ${matchedEmployee.name}'s strong competency alignment and explore advanced mentoring opportunities.`,
      empIncomplete.length
        ? `2. **Course Completion Follow-Up**: Set a milestone target date with ${matchedEmployee.name} to finish the remaining modules in **"${empIncomplete[0].course}"**.`
        : `2. **Continuous Learning**: Review the library catalog for next-level skill building modules suitable for ${matchedEmployee.name}'s career track.`,
      `3. **Development Check-In**: Conduct a 1-on-1 development dialogue to align personal goals with departmental operational standards.`
    )

    return lines.join('\n')
  }

  // 1. Specific Competency Gaps Query (e.g. "What competencies should I improve?", "Which employees in my department have competency gaps?")
  const isCompetencyGapQuery = (
    p.includes('gap') ||
    p.includes('competenc') || // matches competency, competencies, competence
    p.includes('skill') ||
    p.includes('improve') ||
    p.includes('deficien')
  )

  if (isCompetencyGapQuery) {
    if (isSelfScope) {
      if (!gaps.length) {
        return `### 🎯 Personal Competency Standing\nBased on your official system assessments, you currently have **no active competency gaps**! All assessed competencies meet or exceed your role's required targets.`
      }

      const itemsList = gaps.map(g => {
        const gapLower = g.competency.toLowerCase()
        const matchedResource = resources.find(r =>
          r.category.toLowerCase().includes(gapLower) ||
          r.title.toLowerCase().includes(gapLower)
        )
        const matchInfo = matchedResource
          ? `\n  → **Recommended Course from Library**: **"${matchedResource.title}"** (${matchedResource.durationHours} hrs · Category: ${matchedResource.category} · Provider: ${matchedResource.provider})`
          : ''
        return `• **${g.competency}**: Current **${g.currentScore}** vs Required **${g.targetScore}** (Gap: **${g.gap}**)${matchInfo}`
      }).join('\n\n')

      return `### 🎯 Competency Areas for Improvement\nBased on your official system assessments, here are your target competency areas:\n\n${itemsList}\n\n---\n**Growth Tip**: Enrolling in and completing these modules will help raise your overall competency score (currently **${ctx.metrics.averageCompetency}%**) and support your career progression.`
    }

    if (!gaps.length) {
      return `### 📉 Department Competency Gap Assessment\nAs a **${roleTitle}** overseeing **${scopeName}**, based on verified database records, there are currently **no active competency gaps** recorded for employees in your department. All assessed competencies currently meet or exceed their target scores.`
    }

    // Group gaps by employee
    const gapsByEmployee = {}
    gaps.forEach(g => {
      if (!gapsByEmployee[g.employee]) {
        gapsByEmployee[g.employee] = { department: g.department, items: [] }
      }
      gapsByEmployee[g.employee].items.push(g)
    })

    const employeeBlocks = Object.entries(gapsByEmployee).map(([empName, data]) => {
      const itemsList = data.items.map(item => {
        const gapLower = item.competency.toLowerCase()
        const matchedResource = resources.find(r =>
          r.category.toLowerCase().includes(gapLower) ||
          r.title.toLowerCase().includes(gapLower)
        )
        const matchInfo = matchedResource
          ? `\n    → _Suggested Library Module_: **"${matchedResource.title}"** (${matchedResource.durationHours} hrs · ${matchedResource.provider})`
          : ''
        return `  • **${item.competency}**: Current **${item.currentScore}** vs Target **${item.targetScore}** (Gap: **${item.gap}**)${matchInfo}`
      }).join('\n')

      return `#### **${empName}** (${data.department})\n${itemsList}`
    }).join('\n\n')

    return `### 📉 Identified Competency Gaps in ${scopeName}\nAs a **${roleTitle}**, here is the breakdown of employees with active competency gaps based on system assessments:\n\n${employeeBlocks}\n\n---\n**Department Summary**: Total of **${gaps.length}** active competency gap(s) identified across **${Object.keys(gapsByEmployee).length}** employee(s). Department Average Competency is **${ctx.metrics.averageCompetency}%**.\n\n**Next Steps**: Assign targeted modules from the library or schedule 1-on-1 coaching sessions to address these specific gaps.`
  }

  // 2. Incomplete Learning Activities Query (e.g. "What learning activities do I still need to complete?", "Show incomplete learning activities")
  const isIncompleteLearningQuery = (
    p.includes('incomplete') ||
    p.includes('unfinished') ||
    p.includes('pending') ||
    p.includes('learning activit') ||
    p.includes('learning assignment') ||
    p.includes('course progress') ||
    p.includes('need to complete') ||
    p.includes('still need') ||
    p.includes('my course') ||
    p.includes('not completed')
  )

  if (isIncompleteLearningQuery) {
    if (isSelfScope) {
      if (!learning.length) {
        return `### 📚 Your Learning Activities\nYou're all caught up! You currently have **no incomplete or pending learning activities** recorded. All assigned modules are 100% completed.`
      }

      const items = learning.map(l => `• **"${l.course}"**\n  - Progress: **${l.progress}** | Status: **${l.status}**`).join('\n\n')
      return `### 📚 Your Pending Learning Assignments\nBased on your official system records, here are the active learning modules assigned to you:\n\n${items}\n\n---\n**Tip**: Completing your remaining modules will boost your personal learning completion rate (currently at **${ctx.metrics.averageLearningProgress}%**).`
    }

    if (!learning.length) {
      return `### ⏳ Department Learning Activities\nAs a **${roleTitle}** overseeing **${scopeName}**, based on current system records, there are currently **no incomplete or pending learning activities** recorded for your team. All assigned modules are 100% completed!`
    }

    const items = learning.map(l => `• **${l.employee}** (${l.department || 'Department'})\n  - Course: **"${l.course}"** | Progress: **${l.progress}** | Status: **${l.status}**`).join('\n\n')
    return `### ⏳ Incomplete Learning Assignments in ${scopeName}\nAs a **${roleTitle}**, here are the team members with pending or in-progress learning assignments:\n\n${items}\n\n---\n**Supervisory Action**: Follow up with these employees during your next check-in to ensure timely completion. Department learning completion is currently averaging **${ctx.metrics.averageLearningProgress}%**.`
  }

  // 3. Learning recommendations / suggestions
  const isLearningRecommendationQuery = (
    p.includes('suggest') ||
    p.includes('recommend') ||
    p.includes('what can you suggest') ||
    p.includes('what can u suggest') ||
    p.includes('giving them') ||
    p.includes('give them') ||
    p.includes('learning course') ||
    p.includes('learning path') ||
    p.includes('training recommendation') ||
    p.includes('development plan') ||
    p.includes('development recommendation') ||
    p.includes('how to improve') ||
    p.includes('how can i help') ||
    (p.includes('course') && (p.includes('team') || p.includes('them') || p.includes('assign') || p.includes('give') || p.includes('suggest') || p.includes('supervisor') || p.includes('manager')))
  )

  if (isLearningRecommendationQuery) {
    if (!empList.length) {
      return isSelfScope
        ? 'Based on available system records, no personal employee profile was found.'
        : `As a **${roleTitle}** overseeing **${scopeName}**, based on current system records, there are no employee records found in your authorized scope to generate learning recommendations.`
    }

    if (isSelfScope) {
      const self = empList[0]
      const selfGaps = gaps
      const selfIncomplete = learning

      const lines = [
        `### 🎯 Your Personal Learning & Development Plan`,
        `Based on your official records (**${self.name}** — ${self.role}):\n`,
        `• **Current Standing**: Performance: **${self.performanceScore}** | Competency: **${self.competencyScore}** | Learning Progress: **${self.learningProgress}**\n`,
      ]

      if (selfGaps.length) {
        lines.push(`#### 📌 Targeted Modules for Your Skill Gaps:`)
        selfGaps.forEach(g => {
          const gapLower = g.competency.toLowerCase()
          const matchedResource = resources.find(r =>
            r.category.toLowerCase().includes(gapLower) ||
            r.title.toLowerCase().includes(gapLower)
          )
          if (matchedResource) {
            lines.push(
              `• Gap in **${g.competency}** (Current: **${g.currentScore}** → Target: **${g.targetScore}**)` +
              `\n  → **Enroll in**: **"${matchedResource.title}"** (${matchedResource.durationHours} hrs · Category: ${matchedResource.category} · Provider: ${matchedResource.provider})`
            )
          } else {
            lines.push(`• Priority gap in **${g.competency}**: Current **${g.currentScore}** → Target **${g.targetScore}**`)
          }
        })
      }

      if (selfIncomplete.length) {
        lines.push(`\n#### ⏳ In-Progress Assignments to Complete:`)
        selfIncomplete.forEach(l => {
          lines.push(`• **"${l.course}"** (${l.progress} completed · Status: ${l.status})`)
        })
      }

      return lines.join('\n')
    }

    const lines = [
      `### 📋 Supervisory Learning & Capability Recommendations`,
      `As a **${roleTitle}** overseeing **${scopeName}**, here is a data-driven capability analysis and learning action plan grounded strictly in current system records:\n`,
      `#### 1. 📊 Team Capability & Baseline Summary`,
      `• **Monitored Team Members**: ${ctx.metrics.totalEmployees}`,
      `• **Average Performance Score**: **${ctx.metrics.averagePerformance}%**`,
      `• **Average Competency Score**: **${ctx.metrics.averageCompetency}%**`,
      `• **Learning Completion Rate**: **${ctx.metrics.averageLearningProgress}%**`,
      `• **Identified Competency Gaps in Scope**: **${gaps.length}** active gap(s)`,
      `• **Available Learning Resources in Library**: **${resources.length}** course(s)\n`,
      `---\n`,
      `#### 2. 🎯 Targeted Learning Recommendations by Employee`,
    ]

    empList.forEach(emp => {
      const empGaps = gaps
        .filter(g => g.employee === emp.name)
        .sort((a, b) => parseFloat(b.gap) - parseFloat(a.gap))

      const empIncomplete = learning
        .filter(l => l.employee === emp.name)

      lines.push(`\n##### **${emp.name}** — ${emp.role} (${emp.department})`)
      lines.push(`• **Current Standing**: Performance: **${emp.performanceScore}** | Competency: **${emp.competencyScore}** | Learning Progress: **${emp.learningProgress}**`)

      if (empGaps.length) {
        lines.push(`• **Priority Competency Gaps & Matched Courses**:`)
        empGaps.forEach(g => {
          const gapLower = g.competency.toLowerCase()
          const matchedResource = resources.find(r =>
            r.category.toLowerCase().includes(gapLower) ||
            r.title.toLowerCase().includes(gapLower)
          )
          if (matchedResource) {
            lines.push(
              `  - Gap in **${g.competency}** (Current: ${g.currentScore} → Target: ${g.targetScore}, Gap: **${g.gap}**)` +
              `\n    → **Recommended System Course**: **"${matchedResource.title}"** (${matchedResource.durationHours} hrs · Category: ${matchedResource.category} · Provider: ${matchedResource.provider})`
            )
          } else {
            lines.push(
              `  - Gap in **${g.competency}** (Current: ${g.currentScore} → Target: ${g.targetScore}, Gap: **${g.gap}**)` +
              `\n    → _Note: No matching course currently exists in the system library for "${g.competency}". Consider requesting a new module._`
            )
          }
        })
      } else {
        lines.push(`• **Competency Gaps**: No active competency gaps recorded in system assessments.`)
      }

      if (empIncomplete.length) {
        lines.push(`• **Pending In-Progress Activities to Follow Up**:`)
        empIncomplete.forEach(l => {
          lines.push(`  - ⏳ Incomplete: **"${l.course}"** (${l.progress} completed · Status: ${l.status})`)
        })
      }
    })

    lines.push(
      `\n---\n`,
      `#### 3. 🛠️ Actionable Supervisory Next Steps`,
      `1. **Assign Targeted Library Modules**: Enroll employees directly in the matching system courses identified above to address specific competency deficiencies.`,
      `2. **Set Completion Milestones**: Schedule weekly 1-on-1 progress reviews with staff having pending learning activities to ensure timely module completion.`,
      `3. **Schedule Post-Training Competency Re-Assessments**: Once courses are finished, conduct follow-up evaluations to verify skill acquisition and formally close recorded gaps.`
    )

    return lines.join('\n')
  }

  // 4. List employees under department / scope (Roster only)
  const isEmployeeListQuery = (
    (p.includes('list') && (p.includes('employee') || p.includes('staff') || p.includes('member') || p.includes('team') || p.includes('roster'))) ||
    (p.includes('show') && (p.includes('employee') || p.includes('staff') || p.includes('roster') || p.includes('team'))) ||
    (p.includes('who') && (p.includes('work') || p.includes('are the employee') || p.includes('is in my department') || p.includes('are my staff') || p.includes('are the staff') || p.includes('is under me'))) ||
    p === 'employees' || p === 'my team' || p === 'employee list' || p === 'team list' || p === 'department employees'
  )

  if (isEmployeeListQuery && !isSelfScope) {
    if (!empList.length) {
      return `As a **${roleTitle}**, based on available database records, no employee records were found for **${scopeName}**.`
    }
    const items = empList.map(e => `• **${e.name}** — ${e.role} (${e.department})\n  - Performance: **${e.performanceScore}** | Competency: **${e.competencyScore}** | Learning Progress: **${e.learningProgress}**`).join('\n\n')
    return `### 👥 Department Employee Roster\nAs a **${roleTitle}** overseeing **${scopeName}**, here ${empList.length === 1 ? 'is the 1 monitored employee' : `are the ${empList.length} monitored employees`} in your team:\n\n${items}\n\n---\n**Department Summary**: Average Performance is **${ctx.metrics.averagePerformance}%**, Average Competency is **${ctx.metrics.averageCompetency}%**, and Average Learning Progress is **${ctx.metrics.averageLearningProgress}%**.`
  }

  // 5. Highest performance
  if (p.includes('highest performance') || p.includes('top performance') || p.includes('best score') || p.includes('top performer')) {
    if (!empList.length) return 'Based on available records, no employee performance data is present in your scope.'
    const top = empList[0]
    return `### 🏆 Top Performance Record\nBased on current system records for **${scopeName}**:\n\n• **Top Performer**: **${top.name}** (${top.role} · ${top.department})\n• **Performance Score**: **${top.performanceScore}**\n• **Competency Score**: **${top.competencyScore}**\n• **Learning Completion**: **${top.learningProgress}**\n\n**Supervisory Insight**: ${top.name} demonstrates high performance and may be a candidate for leadership tracks or mentoring peers.`
  }

  // 6. Ready Now succession
  if (p.includes('ready now') || p.includes('succession') || p.includes('successor') || p.includes('pipeline')) {
    const readyNow = succession.filter(s => s.readinessBand === 'ready_now')
    if (!readyNow.length) return `### 🌟 Succession Pipeline\nBased on current succession records for **${scopeName}**, there are currently no employees categorized in the **Ready Now** band.`
    const items = readyNow.map(s => `• **${s.employee}** — ${s.jobTitle} (${s.department})\n  - Readiness Score: **${s.readinessScore}** | Status: **Ready Now**`).join('\n\n')
    return `### 🌟 Succession Pipeline — Ready Now Candidates\nBased on verified succession records for **${scopeName}**, there ${readyNow.length === 1 ? 'is 1 candidate' : `are ${readyNow.length} candidates`} ready for promotion or critical role transition:\n\n${items}`
  }

  // 7. Learning resources library catalog inquiry
  if (p.includes('library') || p.includes('available course') || p.includes('catalog') || p.includes('learning resource')) {
    if (!resources.length) return 'There are currently no learning resources registered in the system database library.'
    const items = resources.map(r => `• **"${r.title}"**\n  - Category: **${r.category}** | Duration: **${r.durationHours || 2} hrs** | Provider: **${r.provider}**`).join('\n\n')
    return `### 📚 System Learning Resources Library\nThe database currently contains **${resources.length}** available learning resource(s):\n\n${items}\n\n**Note**: You can assign any of these modules to employees to address identified competency gaps.`
  }

  // 8. Personal score query (for employee)
  if (p.includes('my last performance') || p.includes('my performance') || p.includes('my score') || p.includes('my competency') || p.includes('my record') || p.includes('last performance score')) {
    if (!empList.length) return 'No employee record found for your account.'
    const self = empList[0]
    return `### 👤 Personal Performance & Capability Profile\nBased on your official system records:\n\n• **Employee**: **${self.name}**\n• **Role / Job Title**: **${self.role}** (${self.department})\n• **Performance Score**: **${self.performanceScore}**\n• **Competency Score**: **${self.competencyScore}**\n• **Learning Progress**: **${self.learningProgress}**\n\n**Guidance**: Continue working on your learning modules to further elevate your competency and performance ratings.`
  }

  // 9. General grounded executive summary fallback (Role-Specific)
  if (isSelfScope) {
    const self = empList[0] || {}
    return `### 👤 Personal Performance & Development Overview\nBased on your official system records (**${self.name || 'Your Profile'}**):\n\n• **Job Role**: **${self.role || 'Employee'}** (${self.department || 'Your Department'})\n• **Performance Rating**: **${ctx.metrics.averagePerformance}%**\n• **Competency Score**: **${ctx.metrics.averageCompetency}%**\n• **Learning Completion**: **${ctx.metrics.averageLearningProgress}%**\n• **Active Skill Gaps**: **${gaps.length}** area(s)\n• **Pending Learning Modules**: **${learning.length}** assignment(s)\n\n**Quick Questions You Can Ask:**\n- *"What competencies should I improve?"*\n- *"What learning activities do I still need to complete?"*\n- *"What was my last performance score?"*`
  }

  return `### 📊 Supervisory Overview & System Metrics\nAs a **${roleTitle}** overseeing **${scopeName}**, here is your current data-grounded system summary:\n\n• **Monitored Team Members**: **${ctx.metrics.totalEmployees}**\n• **Average Performance**: **${ctx.metrics.averagePerformance}%**\n• **Average Competency**: **${ctx.metrics.averageCompetency}%**\n• **Learning Completion**: **${ctx.metrics.averageLearningProgress}%**\n• **Succession Ready Now Candidates**: **${ctx.metrics.successionReadyNowCount}**\n• **Registered Learning Resources in Library**: **${resources.length}**\n• **Formal Training Sessions**: **${trainings.length}**\n\n**What would you like to explore next?**\n- Ask for **learning recommendations** for your team or specific employees\n- Inquire about **top competency gaps** and skill improvement plans\n- Review **incomplete learning activities** or **succession readiness**`
}

export default router


