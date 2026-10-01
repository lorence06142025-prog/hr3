import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { sendEmail } from '../services/email.js'

const router = Router()
router.use(authenticate)

// In-memory backing store for interactive live kudos, comments, and reactions
// Combined with official DB recognition workflows
const initialKudos = [
  {
    id: 'kudos-1',
    senderId: 'usr-1',
    senderName: 'Samir Patel',
    senderRole: 'Operations Manager',
    senderDepartment: 'Operations',
    recipientId: 'emp-maria',
    recipientName: 'Maria Lopez',
    recipientDepartment: 'Front Office',
    recipientJobTitle: 'Receptionist',
    badge: 'Guest Delight Champion',
    coreValue: 'Guest Delight',
    tag: '#GuestDelight',
    message: 'Outstanding handling of VIP guest arrival during peak check-in rush yesterday. The guest specifically praised your warm welcome and attentiveness!',
    reactions: { heart: 8, trophy: 6 },
    userReactions: ['heart'],
    comments: [
      {
        id: 'c-1',
        userName: 'Jordan Williams',
        userRole: 'Front Office Manager',
        text: 'Well deserved Maria! Your consistency at the front desk elevates our entire team standard.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'c-2',
        userName: 'Ava Reyes',
        userRole: 'HR Administrator',
        text: 'Adding this commendation to the quarterly hospitality spotlight!',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    isOfficialAward: true,
    status: 'approved',
    approvedBy: 'Ava Reyes (HR)',
    approvedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'kudos-2',
    senderId: 'usr-2',
    senderName: 'Marco Rossi',
    senderRole: 'Executive Chef',
    senderDepartment: 'Kitchen',
    recipientId: 'emp-andre',
    recipientName: 'Andre Tan',
    recipientDepartment: 'Kitchen',
    recipientJobTitle: 'Cook',
    badge: 'Culinary Mastery',
    coreValue: 'Culinary Mastery',
    tag: '#CulinaryMastery',
    message: 'Flawless execution during the Saturday banquet event. Prepared over 180 course plates with zero timing delays and pristine plating quality.',
    reactions: { heart: 14, trophy: 10 },
    userReactions: ['trophy'],
    comments: [
      {
        id: 'c-3',
        userName: 'Robert Johnson',
        userRole: 'Restaurant Manager',
        text: 'The banquet guests sent their direct compliments to the kitchen staff!',
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
    isOfficialAward: false,
    status: 'approved',
    approvedBy: 'Ava Reyes (HR)',
    approvedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'kudos-3',
    senderId: 'usr-3',
    senderName: 'Anna Kowalski',
    senderRole: 'Housekeeping Manager',
    senderDepartment: 'Housekeeping',
    recipientId: 'emp-rosa',
    recipientName: 'Rosa Martinez',
    recipientDepartment: 'Housekeeping',
    recipientJobTitle: 'Housekeeping Staff',
    badge: 'Excellence in Hospitality',
    coreValue: 'Excellence in Hospitality',
    tag: '#ExcellenceInHospitality',
    message: 'Maintained a perfect 100% audit rating for room hygiene and turnaround time across the 4th floor executive suites all week.',
    reactions: { heart: 11, trophy: 4 },
    userReactions: ['heart'],
    comments: [],
    isOfficialAward: true,
    status: 'approved',
    approvedBy: 'Ava Reyes (HR)',
    approvedAt: new Date(Date.now() - 3600000 * 22).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'kudos-4',
    senderId: 'usr-4',
    senderName: 'Emily Thompson',
    senderRole: 'Waitress',
    senderDepartment: 'Food & Beverage',
    recipientId: 'emp-james',
    recipientName: 'James Wilson',
    recipientDepartment: 'Food & Beverage',
    recipientJobTitle: 'Bartender',
    badge: 'Team Player Award',
    coreValue: 'Teamwork & Integrity',
    tag: '#Teamwork',
    message: 'Huge thanks for stepping in and supporting table cocktail service during the Friday night lounge rush without missing a beat!',
    reactions: { heart: 6, trophy: 2 },
    userReactions: ['trophy'],
    comments: [],
    isOfficialAward: false,
    status: 'approved',
    approvedBy: 'Ava Reyes (HR)',
    approvedAt: new Date(Date.now() - 3600000 * 34).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
]

let kudosStore = [...initialKudos]

const createKudosSchema = z.object({
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  recipientDepartment: z.string().optional().default('Hospitality'),
  recipientJobTitle: z.string().optional().default('Hotel Staff'),
  badge: z.string().min(1),
  coreValue: z.string().min(1),
  tag: z.string().min(1),
  message: z.string().min(5).max(1000),
  isOfficialAward: z.boolean().optional(),
})

const commentSchema = z.object({
  text: z.string().min(1).max(500),
})

const reactSchema = z.object({
  reaction: z.enum(['heart', 'trophy', 'thumbsUp', 'star', 'flame']),
})

// GET /api/recognition/feed — fetch published/approved social feed
router.get('/feed', async (req, res, next) => {
  try {
    // Pull only approved posts for the live public Merit Wall
    let dbKudos = []
    try {
      const wfRes = await query(`
        SELECT w.id, w.title, w.created_at, w.metadata,
               e.full_name AS recipient_name, e.department AS recipient_department, e.job_title AS recipient_job_title,
               u.full_name AS sender_name, u.role AS sender_role
        FROM workflows w
        JOIN employees e ON e.id = w.subject_employee_id
        LEFT JOIN users u ON u.id = w.created_by
        WHERE w.module = 'recognition' AND (w.status = 'completed')
        ORDER BY w.updated_at DESC
        LIMIT 10
      `)
      dbKudos = wfRes.rows.map((row) => ({
        id: `wf-${row.id}`,
        senderId: 'system-hr',
        senderName: row.sender_name || 'Hospitality Leadership',
        senderRole: row.sender_role || 'HR',
        senderDepartment: 'Human Resources',
        recipientId: row.id,
        recipientName: row.recipient_name,
        recipientDepartment: row.recipient_department,
        recipientJobTitle: row.recipient_job_title,
        badge: 'Hospitality Merit Award',
        coreValue: 'Excellence in Hospitality',
        tag: '#ExcellenceInHospitality',
        message: row.metadata?.reason || row.title || 'Recognized through official hotel recognition program.',
        reactions: { heart: 7, trophy: 5 },
        userReactions: [],
        comments: [],
        isOfficialAward: true,
        status: 'approved',
        createdAt: row.created_at,
      }))
    } catch {
      // Fallback
    }

    // Merge and filter only approved recognitions
    const combined = kudosStore.filter(k => !k.status || k.status === 'approved')
    dbKudos.forEach((dk) => {
      if (!combined.some(k => k.id === dk.id)) {
        combined.push(dk)
      }
    })

    // Sort by hearts count desc, then createdAt desc (posts with more hearts rank top of the Merit Wall!)
    combined.sort((a, b) => {
      const heartsA = a.reactions?.heart || 0
      const heartsB = b.reactions?.heart || 0
      if (heartsB !== heartsA) return heartsB - heartsA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    res.json({ feed: combined })
  } catch (error) { next(error) }
})

// Helper: Checks if an employee has completed their performance evaluation
export async function checkPerformanceEvaluationCompleted(employeeIdentifier) {
  if (!employeeIdentifier) return false
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(employeeIdentifier))
  let empId = employeeIdentifier
  if (!isUuid) {
    const empLookup = await query(
      'SELECT id FROM employees WHERE id::text = $1 OR employee_number = $1 OR full_name ILIKE $1 LIMIT 1',
      [String(employeeIdentifier)]
    )
    if (empLookup.rows[0]) {
      empId = empLookup.rows[0].id
    } else {
      return false
    }
  }

  const res = await query(`
    SELECT 1 FROM workflows
    WHERE module = 'performance'
      AND subject_employee_id = $1
      AND (
        status = 'completed'
        OR current_stage = 'published'
        OR EXISTS (
          SELECT 1 FROM workflow_events we
          WHERE we.workflow_id = workflows.id
            AND we.stage = 'performance_evaluation'
            AND we.event_type = 'advanced'
        )
      )
    LIMIT 1
  `, [empId])
  return res.rows.length > 0
}

// GET /api/recognition/colleagues — list employees eligible for recognition with RBAC-filtered metrics
router.get('/colleagues', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    const isHrOrAdmin = role === 'hr' || role === 'operations_manager'

    const { rows } = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.job_title, e.avatar_url,
             e.performance_score, e.competency_score, e.learning_progress,
             EXISTS (
               SELECT 1 FROM workflows w
               WHERE w.subject_employee_id = e.id
                 AND w.module = 'performance'
                 AND (
                   w.status = 'completed'
                   OR w.current_stage = 'published'
                   OR EXISTS (
                     SELECT 1 FROM workflow_events we
                     WHERE we.workflow_id = w.id
                       AND we.stage = 'performance_evaluation'
                       AND we.event_type = 'advanced'
                   )
                 )
             ) AS has_completed_performance_eval
      FROM employees e
      WHERE e.is_active = true
      ORDER BY e.full_name ASC
    `)

    // Resolve calling user's employee record to determine nominator eligibility
    let callerEmployeeId = req.user.employeeId || req.user.employee_id
    if (!callerEmployeeId && req.user.sub) {
      const u = await query('SELECT employee_id FROM users WHERE id = $1', [req.user.sub])
      callerEmployeeId = u.rows[0]?.employee_id
    }
    const userHasCompletedEvaluation = isHrOrAdmin
      ? true
      : await checkPerformanceEvaluationCompleted(callerEmployeeId)

    const userEligibility = {
      canNominate: Boolean(isHrOrAdmin || userHasCompletedEvaluation),
      hasCompletedPerformanceEvaluation: Boolean(userHasCompletedEvaluation),
      reason: (!isHrOrAdmin && !userHasCompletedEvaluation)
        ? 'You must complete your performance evaluation before submitting recognition nominations.'
        : null,
    }

    // Strict RBAC: Only authorized HR / Admin can access performance, competency, and learning percentages
    const colleagues = rows.map((emp) => {
      const basic = {
        id: emp.id,
        employee_number: emp.employee_number,
        full_name: emp.full_name,
        department: emp.department,
        job_title: emp.job_title,
        avatar_url: emp.avatar_url || null,
        has_completed_performance_eval: Boolean(emp.has_completed_performance_eval),
      }

      if (isHrOrAdmin) {
        return {
          ...basic,
          performance_score: Number(emp.performance_score || 0),
          competency_score: Number(emp.competency_score || 0),
          learning_progress: Number(emp.learning_progress || 0),
        }
      }

      // Non-HR users (regular employees, supervisors, etc.) receive strictly basic profile info + eligibility flag
      return basic
    })

    res.json({ employees: colleagues, userEligibility })
  } catch (error) { next(error) }
})

// GET /api/recognition/pending — fetch nominations awaiting supervisor validation or HR review
router.get('/pending', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    const userId = req.user.sub
    const isHrOrAdmin = role === 'hr' || role === 'operations_manager'

    // Filter pending based on RBAC:
    // HR & Ops Manager see all awaiting_hr and awaiting_supervisor
    // Supervisors see awaiting_supervisor for their department/employees and their own
    // Employees see their own submitted nominations
    const pendingList = kudosStore.filter(k => {
      if (k.status === 'approved' || k.status === 'rejected') return false
      if (isHrOrAdmin || role === 'management') return true
      if (role === 'supervisor') {
        return k.status === 'awaiting_supervisor' || k.senderId === userId || k.senderDepartment === req.user.department
      }
      return k.senderId === userId
    })

    let enrichedPendingList = pendingList

    // HR validation: Attach recognized employee's Performance, Learning, and Competency metrics exclusively for HR
    if (isHrOrAdmin && pendingList.length > 0) {
      try {
        const empRes = await query(`
          SELECT id::text, full_name, performance_score, competency_score, learning_progress
          FROM employees
          WHERE is_active = true
        `)
        const empMap = new Map()
        empRes.rows.forEach(e => {
          empMap.set(e.id, e)
          if (e.full_name) empMap.set(e.full_name.toLowerCase(), e)
        })

        enrichedPendingList = pendingList.map(item => {
          const emp = empMap.get(item.recipientId) || (item.recipientName ? empMap.get(item.recipientName.toLowerCase()) : null)
          return {
            ...item,
            recipientMetrics: {
              performance: emp ? Number(emp.performance_score || 0) : 0,
              competency: emp ? Number(emp.competency_score || 0) : 0,
              learning: emp ? Number(emp.learning_progress || 0) : 0,
            }
          }
        })
      } catch {
        // Fallback without breaking endpoint
        enrichedPendingList = pendingList.map(item => ({
          ...item,
          recipientMetrics: { performance: 0, competency: 0, learning: 0 }
        }))
      }
    } else {
      // Ensure regular employees and non-HR never receive recipientMetrics
      enrichedPendingList = pendingList.map(({ recipientMetrics, ...rest }) => rest)
    }

    res.json({
      pending: enrichedPendingList,
      counts: {
        awaitingSupervisor: kudosStore.filter(k => k.status === 'awaiting_supervisor').length,
        awaitingHr: kudosStore.filter(k => k.status === 'awaiting_hr').length,
        totalPending: kudosStore.filter(k => k.status === 'awaiting_supervisor' || k.status === 'awaiting_hr').length,
      }
    })
  } catch (error) { next(error) }
})

// POST /api/recognition/post — submit recognition / nomination
router.post('/post', async (req, res, next) => {
  try {
    const input = createKudosSchema.parse(req.body)
    const role = req.user.role || 'employee'
    const isHr = role === 'hr' || role === 'operations_manager'
    const isSupervisor = role === 'supervisor'

    // ── PERFORMANCE EVALUATION PREREQUISITE CHECKS ──
    // 1. Nominator check: Non-HR employees must have completed a performance evaluation first
    if (!isHr) {
      let callerEmployeeId = req.user.employeeId || req.user.employee_id
      if (!callerEmployeeId && req.user.sub) {
        const u = await query('SELECT employee_id FROM users WHERE id = $1', [req.user.sub])
        callerEmployeeId = u.rows[0]?.employee_id
      }

      const nominatorHasCompleted = await checkPerformanceEvaluationCompleted(callerEmployeeId)
      if (!nominatorHasCompleted) {
        return res.status(403).json({
          error: 'Performance Evaluation prerequisite required. You must complete your performance evaluation before submitting recognition nominations.',
          code: 'NOMINATOR_EVALUATION_REQUIRED',
        })
      }
    }

    // 2. Nominee check: The recognized colleague must have completed a performance evaluation first
    const nomineeHasCompleted = await checkPerformanceEvaluationCompleted(input.recipientId || input.recipientName)
    if (!nomineeHasCompleted) {
      return res.status(400).json({
        error: `Performance Evaluation prerequisite required. ${input.recipientName || 'The selected employee'} has not completed a performance evaluation yet and is not eligible for recognition.`,
        code: 'RECIPIENT_EVALUATION_REQUIRED',
      })
    }

    // Flow determination:
    // 1. Employee submits -> status = 'awaiting_supervisor'
    // 2. Supervisor submits -> status = 'awaiting_hr'
    // 3. HR Admin submits -> status = 'approved' (posted immediately to the wall)
    let initialStatus = 'awaiting_supervisor'
    let isOfficialAward = false

    if (isHr) {
      initialStatus = 'approved'
      isOfficialAward = true
    } else if (isSupervisor) {
      initialStatus = 'awaiting_hr'
      isOfficialAward = true
    }

    const newKudos = {
      id: `kudos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: req.user.sub,
      senderName: req.user.name || 'Team Member',
      senderRole: role,
      senderDepartment: req.user.department || 'Hospitality',
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      recipientDepartment: input.recipientDepartment,
      recipientJobTitle: input.recipientJobTitle,
      badge: input.badge,
      coreValue: input.coreValue,
      tag: input.tag.startsWith('#') ? input.tag : `#${input.tag}`,
      message: input.message,
      reactions: { heart: 0, trophy: 0 },
      userReactions: [],
      comments: [],
      isOfficialAward,
      status: initialStatus,
      validatedBy: isSupervisor ? req.user.name : null,
      validatedAt: isSupervisor ? new Date().toISOString() : null,
      approvedBy: isHr ? req.user.name : null,
      approvedAt: isHr ? new Date().toISOString() : null,
      cycleMonth: activeCycleMonth,
      createdAt: new Date().toISOString(),
    }

    kudosStore.unshift(newKudos)

    // Notify appropriate reviewers
    if (initialStatus === 'awaiting_supervisor') {
      try {
        await query(
          'INSERT INTO notifications(user_id, title, message) SELECT id, $1, $2 FROM users WHERE role IN (\'supervisor\', \'operations_manager\') AND is_active = true',
          ['Recognition Nomination Pending Validation', `${req.user.name} submitted a recognition nomination for ${input.recipientName} awaiting supervisor validation.`]
        )
      } catch {}
    } else if (initialStatus === 'awaiting_hr') {
      try {
        await query(
          'INSERT INTO notifications(user_id, title, message) SELECT id, $1, $2 FROM users WHERE role = \'hr\' AND is_active = true',
          ['Recognition Validated - Awaiting HR Approval', `Supervisor ${req.user.name} submitted/validated recognition for ${input.recipientName} awaiting final HR approval to publish.`]
        )
      } catch {}
    } else if (initialStatus === 'approved') {
      try {
        await query(
          'INSERT INTO notifications(user_id, title, message) SELECT id, $1, $2 FROM users WHERE full_name = $3 AND is_active = true',
          ['Recognition Awarded on Merit Wall', `${req.user.name} recognized you on the Social Recognition Wall: "${input.badge}"`, input.recipientName]
        )
      } catch {}
    }

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.nominate',
      category: 'recognition',
      description: `${req.user.name} submitted recognition for ${input.recipientName} (${initialStatus})`,
      details: { badge: input.badge, tag: input.tag, status: initialStatus },
    })

    res.status(201).json({
      post: newKudos,
      status: initialStatus,
      message: initialStatus === 'approved'
        ? `Recognition officially approved and published on the Merit Wall!`
        : initialStatus === 'awaiting_hr'
        ? `Nomination validated! Forwarded to HR for final review & publishing.`
        : `Nomination submitted! Awaiting supervisor validation before HR approval.`
    })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/validate — supervisor validates nomination -> forwards to HR
router.post('/:id/validate', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    if (role !== 'supervisor' && role !== 'operations_manager' && role !== 'hr' && role !== 'management') {
      return res.status(403).json({ error: 'Only supervisors and management can validate nominations.' })
    }

    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Nomination not found.' })

    post.status = 'awaiting_hr'
    post.validatedBy = req.user.name || 'Supervisor'
    post.validatedAt = new Date().toISOString()
    if (req.body.note) {
      post.supervisorNote = req.body.note
    }

    // Notify HR
    try {
      await query(
        'INSERT INTO notifications(user_id, title, message) SELECT id, $1, $2 FROM users WHERE role = \'hr\' AND is_active = true',
        ['Recognition Validated for HR Review', `Supervisor ${req.user.name} validated recognition for ${post.recipientName}. Ready for HR approval.`]
      )
    } catch {}

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.validate',
      category: 'recognition',
      description: `${req.user.name} validated recognition nomination for ${post.recipientName}`,
    })

    res.json({
      success: true,
      post,
      message: `Nomination for ${post.recipientName} validated! Forwarded to HR Admin for final approval.`
    })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/approve — HR reviews and approves -> published to Merit Wall!
router.post('/:id/approve', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    if (role !== 'hr' && role !== 'operations_manager' && role !== 'management') {
      return res.status(403).json({ error: 'Only HR Administrators can give final approval to post to the Merit Wall.' })
    }

    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Nomination not found.' })

    post.status = 'approved'
    post.approvedBy = req.user.name || 'HR Administrator'
    post.approvedAt = new Date().toISOString()
    if (req.body.isOfficialAward !== undefined) {
      post.isOfficialAward = req.body.isOfficialAward
    } else {
      post.isOfficialAward = post.senderRole === 'hr' || post.senderRole === 'supervisor' || post.senderRole === 'operations_manager'
    }

    // Notify recipient that their recognition is now live on the Merit Wall!
    try {
      const userRes = await query(
        'SELECT id, email, full_name FROM users WHERE full_name = $1 AND is_active = true',
        [post.recipientName]
      )
      if (userRes.rows[0]) {
        const recipientUser = userRes.rows[0]
        await query(
          'INSERT INTO notifications(user_id, title, message) VALUES($1, $2, $3)',
          [recipientUser.id, 'Recognition Published on Merit Wall', `Congratulations! Your recognition for "${post.badge}" was approved by HR and is now live on the Merit Wall!`]
        )

        if (recipientUser.email) {
          sendEmail({
            to: recipientUser.email,
            subject: `🌟 Recognition Commendation: ${post.badge}`,
            text: `Congratulations ${post.recipientName}! You have received recognition from ${post.senderName} (${post.senderRole}): "${post.message}"`,
            details: [
              ['Commendation Badge', post.badge],
              ['Core Hospitality Value', post.coreValue],
              ['Recognized By', `${post.senderName} (${post.senderDepartment})`],
              ['Commendation Note', post.message],
            ],
            actionUrl: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/recognition`,
            actionText: 'View on Merit Wall',
          }).catch(err => console.warn('[PDS EMAIL] Recognition email error:', err.message))
        }
      }
    } catch {}

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.approve',
      category: 'recognition',
      description: `${req.user.name} approved recognition for ${post.recipientName} onto the Merit Wall`,
    })

    res.json({
      success: true,
      post,
      message: `Recognition for ${post.recipientName} approved and published on the Merit Wall!`
    })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/reject — reject nomination
router.post('/:id/reject', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    if (role !== 'hr' && role !== 'supervisor' && role !== 'operations_manager' && role !== 'management') {
      return res.status(403).json({ error: 'Unauthorized to reject nominations.' })
    }

    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Nomination not found.' })

    post.status = 'rejected'
    post.rejectedBy = req.user.name
    post.rejectedAt = new Date().toISOString()
    post.rejectionNote = req.body.note || 'Nomination did not meet criteria.'

    res.json({
      success: true,
      post,
      message: `Nomination for ${post.recipientName} has been declined.`
    })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/react — toggle reaction on post
router.post('/:id/react', async (req, res, next) => {
  try {
    const { reaction } = reactSchema.parse(req.body)
    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Recognition post not found.' })

    const userHasReacted = post.userReactions.includes(reaction)
    if (userHasReacted) {
      post.userReactions = post.userReactions.filter(r => r !== reaction)
      post.reactions[reaction] = Math.max(0, (post.reactions[reaction] || 1) - 1)
    } else {
      post.userReactions.push(reaction)
      post.reactions[reaction] = (post.reactions[reaction] || 0) + 1
    }

    res.json({ reactions: post.reactions, userReactions: post.userReactions })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/comment — add a comment
router.post('/:id/comment', async (req, res, next) => {
  try {
    const input = commentSchema.parse(req.body)
    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Recognition post not found.' })

    const comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      userName: req.user.name || 'Team Member',
      userRole: req.user.role,
      text: input.text,
      createdAt: new Date().toISOString(),
    }

    post.comments.push(comment)
    res.status(201).json({ comment, totalComments: post.comments.length })
  } catch (error) { next(error) }
})

// Active recognition cycle month (defaults to current month, timezone-safe)
const _now = new Date()
let activeCycleMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`
const resetMonths = new Set() // Set of months explicitly reset or initialized fresh

function formatMonthLabel(monthStr) {
  try {
    const [y, m] = monthStr.split('-')
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return 'Current Month'
  }
}

function calculateMonthlySpotlight(monthKey) {
  const currentKey = monthKey || activeCycleMonth
  const monthLabel = formatMonthLabel(currentKey)
  const isResetOrUpcoming = resetMonths.has(currentKey) || currentKey > '2026-09'

  // Filter approved kudos
  const approved = kudosStore.filter(k => (!k.status || k.status === 'approved'))

  // Aggregate by recipient
  const staffMap = new Map()

  // Baseline sample figures ONLY for September 2026 if it hasn't been reset
  if (!isResetOrUpcoming && currentKey === '2026-09') {
    const baseStaff = [
      { name: 'Maria Lopez', department: 'Front Office', jobTitle: 'Receptionist', count: 12, heartsCount: 38, badgesCount: 6 },
      { name: 'Andre Tan', department: 'Kitchen', jobTitle: 'Cook', count: 10, heartsCount: 29, badgesCount: 5 },
      { name: 'Rosa Martinez', department: 'Housekeeping', jobTitle: 'Housekeeping Staff', count: 9, heartsCount: 24, badgesCount: 4 },
      { name: 'James Wilson', department: 'Food & Beverage', jobTitle: 'Bartender', count: 8, heartsCount: 21, badgesCount: 4 },
      { name: 'Emily Thompson', department: 'Food & Beverage', jobTitle: 'Waitress', count: 7, heartsCount: 18, badgesCount: 3 },
    ]
    baseStaff.forEach(s => staffMap.set(s.name, { ...s }))
  }

  // Aggregate live kudos matching this month
  approved.forEach(k => {
    const kDate = (k.createdAt || '').slice(0, 7)
    const matchesMonth = k.cycleMonth === currentKey || (kDate === currentKey) || (!isResetOrUpcoming && currentKey === '2026-09' && !kDate)

    if (matchesMonth && k.recipientName) {
      const existing = staffMap.get(k.recipientName) || {
        name: k.recipientName,
        department: k.recipientDepartment || 'Hospitality',
        jobTitle: k.recipientJobTitle || 'Hotel Staff',
        count: 0,
        heartsCount: 0,
        badgesCount: 0,
      }
      existing.count += 1
      existing.heartsCount += (k.reactions?.heart || 0)
      existing.badgesCount += 1
      staffMap.set(k.recipientName, existing)
    }
  })

  // Sort top staff: primary by heartsCount + count, descending
  const topStaff = Array.from(staffMap.values())
    .sort((a, b) => (b.heartsCount * 2 + b.count) - (a.heartsCount * 2 + a.count))
    .slice(0, 5)

  // Aggregate Department Kudos (reset to 0 for upcoming / reset months)
  const deptMap = new Map([
    ['Front Office', { department: 'Front Office', totalKudos: isResetOrUpcoming ? 0 : 34, icon: 'hotel' }],
    ['Kitchen', { department: 'Kitchen', totalKudos: isResetOrUpcoming ? 0 : 31, icon: 'utensils' }],
    ['Food & Beverage', { department: 'Food & Beverage', totalKudos: isResetOrUpcoming ? 0 : 27, icon: 'coffee' }],
    ['Housekeeping', { department: 'Housekeeping', totalKudos: isResetOrUpcoming ? 0 : 23, icon: 'sparkles' }],
    ['Operations', { department: 'Operations', totalKudos: isResetOrUpcoming ? 0 : 15, icon: 'settings' }],
  ])

  approved.forEach(k => {
    const kDate = (k.createdAt || '').slice(0, 7)
    const matchesMonth = k.cycleMonth === currentKey || (kDate === currentKey) || (!isResetOrUpcoming && currentKey === '2026-09' && !kDate)
    if (matchesMonth) {
      const dept = k.recipientDepartment
      if (dept && deptMap.has(dept)) {
        deptMap.get(dept).totalKudos += 1
      } else if (dept) {
        deptMap.set(dept, { department: dept, totalKudos: 1, icon: 'hotel' })
      }
    }
  })

  const topDepartments = Array.from(deptMap.values())
    .sort((a, b) => b.totalKudos - a.totalKudos)

  const coreValues = [
    { tag: '#ExcellenceInHospitality', label: 'Excellence in Hospitality', count: 48, icon: 'award' },
    { tag: '#GuestDelight', label: 'Guest Delight', count: 42, icon: 'star' },
    { tag: '#Teamwork', label: 'Teamwork & Integrity', count: 36, icon: 'users' },
    { tag: '#CulinaryMastery', label: 'Culinary Mastery', count: 28, icon: 'flame' },
    { tag: '#SafetyFirst', label: 'Safety & Hygiene First', count: 22, icon: 'shield' },
    { tag: '#Leadership', label: 'Leadership in Action', count: 19, icon: 'crown' },
  ]

  return {
    monthKey: currentKey,
    monthLabel,
    activeCycleMonth,
    isActiveCycle: currentKey === activeCycleMonth,
    isResetOrUpcoming,
    topStaff,
    topDepartments,
    coreValues,
    refreshedAt: new Date().toISOString(),
  }
}

// GET /api/recognition/cycle/active — get active recognition cycle info
router.get('/cycle/active', (_req, res) => {
  res.json({
    activeMonth: activeCycleMonth,
    activeMonthLabel: formatMonthLabel(activeCycleMonth),
  })
})

// POST /api/recognition/cycle/reset — reset and activate spotlight cycle for upcoming month (HR/Admin only)
router.post('/cycle/reset', async (req, res, next) => {
  try {
    const role = req.user.role || 'employee'
    if (role !== 'hr' && role !== 'operations_manager' && role !== 'management') {
      return res.status(403).json({ error: 'Unauthorized: Only HR Administrators and Management can reset the recognition cycle.' })
    }

    const { targetMonth } = req.body
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ error: 'Valid targetMonth (YYYY-MM) is required' })
    }

    activeCycleMonth = targetMonth
    resetMonths.add(targetMonth)

    const result = calculateMonthlySpotlight(targetMonth)

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.cycle_reset',
      category: 'recognition',
      description: `${req.user.name} reset and activated the Monthly Staff Spotlight cycle for ${result.monthLabel}`,
      details: { targetMonth },
    })

    res.json({
      success: true,
      message: `Monthly Staff Spotlight and Department Kudos reset for ${result.monthLabel}! Clean slate activated.`,
      ...result,
    })
  } catch (error) { next(error) }
})

// GET /api/recognition/leaderboard — monthly recognition statistics with month filter
router.get('/leaderboard', async (req, res, next) => {
  try {
    const monthKey = req.query.month || activeCycleMonth
    const result = calculateMonthlySpotlight(monthKey)
    res.json(result)
  } catch (error) { next(error) }
})

// POST /api/recognition/leaderboard/refresh — refresh monthly staff spotlight and department kudos
router.post('/leaderboard/refresh', async (req, res, next) => {
  try {
    const monthKey = req.body.month || activeCycleMonth
    const result = calculateMonthlySpotlight(monthKey)

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.refresh_leaderboard',
      category: 'recognition',
      description: `${req.user.name} refreshed the Monthly Staff Spotlight and Department Kudos for ${result.monthLabel}`,
      details: { monthKey },
    })

    res.json({
      success: true,
      message: `Monthly Staff Spotlight and Department Kudos refreshed for ${result.monthLabel}!`,
      ...result,
    })
  } catch (error) { next(error) }
})

export default router
