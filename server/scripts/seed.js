import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

console.log('🌱 Starting Priority Handling Services, Inc. database seeding...')

// 1. All 11 Hotel Departments
const departments = [
  'Executive Office',
  'Human Resources',
  'Operations',
  'Front Office',
  'Housekeeping',
  'Food & Beverage',
  'Kitchen',
  'Engineering',
  'Security',
  'Sales & Marketing',
  'Finance',
]

for (const name of departments) {
  await pool.query(
    'INSERT INTO departments(name) VALUES($1) ON CONFLICT(name) DO NOTHING',
    [name]
  )
}

// 2. Realistic Hotel Staff Profiles Across All Departments
// [number, name, department, title, performance, competency, learning, role, email]
const staffProfiles = [
  // Executive & HR
  ['E004', 'Ava Reyes',        'Human Resources',   'HR Administrator',           92, 90, 88, 'hr',                'ava@pds.local'],
  ['E005', 'Noah Santos',      'Executive Office',  'General Manager',            94, 92, 89, 'management',        'noah@pds.local'],
  ['E006', 'Samir Patel',      'Operations',        'Director of Operations',     90, 88, 85, 'operations_manager','samir@pds.local'],
  
  // Department Heads / Supervisors
  ['E002', 'Jordan Williams',  'Front Office',      'Front Office Manager',       88, 88, 82, 'supervisor',        'jordan@pds.local'],
  ['E010', 'Anna Kowalski',    'Housekeeping',      'Executive Housekeeper',      86, 85, 80, 'supervisor',        'anna@pds.local'],
  ['E013', 'Robert Johnson',   'Food & Beverage',   'Food & Beverage Director',   87, 86, 82, 'supervisor',        'robert@pds.local'],
  ['E017', 'Marco Rossi',      'Kitchen',           'Executive Chef',             91, 89, 84, 'supervisor',        'marco@pds.local'],
  ['E022', 'Victor Cruz',      'Engineering',       'Chief Engineer',             89, 87, 80, 'supervisor',        'victor@pds.local'],
  ['E024', 'Marcus Vance',     'Security',          'Director of Security',       88, 88, 83, 'supervisor',        'marcus@pds.local'],
  ['E026', 'Elena Rostova',    'Sales & Marketing', 'Director of Sales',          90, 91, 86, 'supervisor',        'elena@pds.local'],
  ['E028', 'Daniel Zhang',     'Finance',           'Financial Controller',       93, 90, 87, 'supervisor',        'daniel@pds.local'],

  // Front Office Team
  ['E007', 'Maria Lopez',      'Front Office',      'Front Desk Supervisor',      86, 84, 80, 'employee',          'maria@pds.local'],
  ['E008', 'David Kim',        'Front Office',      'Night Auditor & Reception',  82, 81, 75, 'employee',          'david@pds.local'],
  ['E009', 'Sofia Garcia',     'Front Office',      'Head Concierge',             85, 87, 79, 'employee',          'sofia@pds.local'],

  // Housekeeping Team
  ['E011', 'Rosa Martinez',    'Housekeeping',      'Senior Room Attendant',      92, 85, 78, 'employee',          'rosa@pds.local'],
  ['E012', 'Linda Chen',       'Housekeeping',      'Linen & Laundry Lead',       83, 80, 74, 'employee',          'linda@pds.local'],
  ['E020', 'Carlos Mendoza',   'Housekeeping',      'Floor Supervisor',           86, 83, 76, 'employee',          'carlos@pds.local'],

  // Food & Beverage Team
  ['E001', 'Emily Thompson',   'Food & Beverage',   'Lead Server',                85, 84, 76, 'employee',          'emily@pds.local'],
  ['E014', 'Chloe Brown',      'Food & Beverage',   'Banquet Server',             81, 80, 71, 'employee',          'chloe@pds.local'],
  ['E015', 'James Wilson',     'Food & Beverage',   'Head Mixologist / Bartender',86, 85, 75, 'employee',          'james@pds.local'],
  ['E016', 'Grace Lee',        'Food & Beverage',   'Dining Room Hostess',        84, 82, 73, 'employee',          'grace@pds.local'],

  // Kitchen Team
  ['E018', 'Andre Tan',        'Kitchen',           'Sous Chef',                  88, 86, 80, 'employee',          'andre@pds.local'],
  ['E019', 'Nina Petrova',     'Kitchen',           'Pastry Chef',                85, 84, 77, 'employee',          'nina@pds.local'],
  ['E021', 'Lucas Meyer',      'Kitchen',           'Line Cook',                  80, 79, 72, 'employee',          'lucas@pds.local'],

  // Engineering Team
  ['E023', 'Samuel Ramos',     'Engineering',       'HVAC & Maintenance Tech',    84, 82, 78, 'employee',          'samuel@pds.local'],

  // Security Team
  ['E025', 'Ryan O Connor',    'Security',          'CCTV & Patrol Officer',      83, 84, 76, 'employee',          'ryan@pds.local'],

  // Sales & Marketing Team
  ['E027', 'Maya Patel',       'Sales & Marketing', 'Events & Banquet Coordinator',86, 87, 81, 'employee',         'maya@pds.local'],

  // Finance Team
  ['E029', 'Clara Smith',      'Finance',           'Senior General Accountant',  89, 88, 83, 'employee',          'clara@pds.local'],
]

// Reporting Hierarchy: Department Head Employee Numbers
const deptHeadMap = {
  'Front Office': 'E002',
  'Housekeeping': 'E010',
  'Food & Beverage': 'E013',
  'Kitchen': 'E017',
  'Engineering': 'E022',
  'Security': 'E024',
  'Sales & Marketing': 'E026',
  'Finance': 'E028',
  'Human Resources': 'E004',
  'Operations': 'E006',
  'Executive Office': 'E005',
}

const employeeDbMap = {}

for (const [number, name, dept, title, perf, comp, learn, role, email] of staffProfiles) {
  // Determine Manager ID (if supervisor, reports to GM E005 or Ops Manager E006)
  const isDeptHead = Object.values(deptHeadMap).includes(number)
  const managerNumber = isDeptHead 
    ? (number === 'E005' ? null : (number === 'E006' ? 'E005' : 'E006'))
    : (deptHeadMap[dept] && number !== deptHeadMap[dept] ? deptHeadMap[dept] : 'E006')

  const manager = managerNumber
    ? await pool.query('SELECT id FROM employees WHERE employee_number = $1', [managerNumber])
    : null

  const empRes = await pool.query(
    `INSERT INTO employees(
       employee_number, full_name, department, department_id, job_title, manager_id,
       performance_score, competency_score, learning_progress
     )
     VALUES($1, $2, $3, (SELECT id FROM departments WHERE name=$3), $4, $5, $6, $7, $8)
     ON CONFLICT(employee_number) DO UPDATE SET
       full_name=EXCLUDED.full_name,
       department=EXCLUDED.department,
       department_id=EXCLUDED.department_id,
       job_title=EXCLUDED.job_title,
       manager_id=EXCLUDED.manager_id,
       performance_score=EXCLUDED.performance_score,
       competency_score=EXCLUDED.competency_score,
       learning_progress=EXCLUDED.learning_progress
     RETURNING id`,
    [number, name, dept, title, manager?.rows[0]?.id || null, perf, comp, learn]
  )

  const employeeId = empRes.rows[0].id
  employeeDbMap[number] = employeeId

  const existingUser = await pool.query(
    'SELECT id FROM users WHERE employee_id=$1 OR email=$2',
    [employeeId, email]
  )
  if (existingUser.rows.length > 0) {
    await pool.query(
      `UPDATE users SET
         employee_id=$1, email=$2, password_hash=$3, full_name=$4, role=$5
       WHERE id=$6`,
      [employeeId, email, passwordHash, name, role, existingUser.rows[0].id]
    )
  } else {
    await pool.query(
      `INSERT INTO users(employee_id, email, password_hash, full_name, role)
       VALUES($1, $2, $3, $4, $5)`,
      [employeeId, email, passwordHash, name, role]
    )
  }
}

// 3. Learning Resources & Catalog
const learningResources = [
  {
    title: 'HACCP Food Safety & Kitchen Hygiene Standards',
    description: 'Comprehensive certification on Hazard Analysis Critical Control Points, food temperature control, sanitization, and allergy management.',
    category: 'Food Safety & Culinary',
    provider: 'International Hospitality Safety Council',
    provider_type: 'external',
    duration_hours: 8,
    objectives: 'Understand critical control points, cross-contamination prevention, and kitchen sanitation compliance.',
    competency: 'Food Safety & Hygiene'
  },
  {
    title: 'Opera PMS Front Desk Excellence & VIP Handling',
    description: 'Mastering Opera Property Management System, guest folio accuracy, express check-in/out, and personalized VIP protocols.',
    category: 'Front Office & Guest Services',
    provider: 'Hospitality Tech Institute',
    provider_type: 'internal',
    duration_hours: 6,
    objectives: 'Operate PMS with zero transaction errors, handle billing discrepancies, and provide 5-star concierge guidance.',
    competency: 'Front Desk Operations'
  },
  {
    title: 'Housekeeping Chemical Safety & Infection Control',
    description: 'Standard operating procedures for chemical dilutions, PPE protocols, color-coded microfiber sanitization, and room turnaround speed.',
    category: 'Housekeeping Operations',
    provider: 'Ecolab Hospitality Training',
    provider_type: 'external',
    duration_hours: 5,
    objectives: 'Safely handle hospitality sanitizers, prevent cross-contamination, and meet room inspection quotas.',
    competency: 'Cleaning Standards & Safety'
  },
  {
    title: 'Hospitality De-escalation & Service Recovery',
    description: 'Tactical communication techniques for resolving guest complaints, handling service delays, and transforming negative experiences into brand loyalty.',
    category: 'Guest Relations',
    provider: 'Luxury Hotel Academy',
    provider_type: 'internal',
    duration_hours: 4,
    objectives: 'Apply the LAST model (Listen, Apologize, Solve, Thank) to restore guest trust effectively.',
    competency: 'Customer Service Excellence'
  },
  {
    title: 'OSHA & Preventive Maintenance for Engineering',
    description: 'Lockout/Tagout (LOTO) safety, HVAC preventative maintenance cycles, electrical troubleshooting, and emergency generator testing.',
    category: 'Engineering & Facilities',
    provider: 'Hotel Engineering Association',
    provider_type: 'external',
    duration_hours: 10,
    objectives: 'Execute preventative work orders with zero safety violations and maintain equipment uptime above 98%.',
    competency: 'Technical & Equipment Maintenance'
  }
]

const hrUserRes = await pool.query("SELECT id FROM users WHERE role='hr' LIMIT 1")
const adminId = hrUserRes.rows[0]?.id || null

for (const lr of learningResources) {
  const existingRes = await pool.query('SELECT id FROM learning_resources WHERE title=$1', [lr.title])
  let resId = existingRes.rows[0]?.id
  if (!resId) {
    const res = await pool.query(
      `INSERT INTO learning_resources(title, description, category, provider, provider_type, duration_hours, objectives, created_by)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [lr.title, lr.description, lr.category, lr.provider, lr.provider_type, lr.duration_hours, lr.objectives, adminId]
    )
    resId = res.rows[0]?.id
  }
  if (resId && lr.competency) {
    await pool.query(
      `INSERT INTO learning_resource_competencies(resource_id, competency)
       VALUES($1, $2) ON CONFLICT DO NOTHING`,
      [resId, lr.competency]
    )
  }
}

// 4. Sample Scheduled Training Sessions
const trainingSessions = [
  {
    title: 'Five-Star Luxury Guest Courtesy & De-escalation Workshop',
    description: 'Interactive workshop on service recovery, concierge etiquette, and VIP guest engagement across all front-of-house departments.',
    category: 'Guest Service Excellence',
    trainer: 'Ava Reyes (HR Director) & Jordan Williams',
    venue: 'Grand Palm Ballroom / Training Hall B',
    start_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    start_time: '09:00:00',
    end_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    end_time: '12:30:00',
    capacity: 25,
    budget: 1500.00,
    department: 'All Departments',
    status: 'scheduled'
  },
  {
    title: 'Culinary HACCP & Chemical Safety Refresh 2026',
    description: 'Mandatory hygiene certification for kitchen line cooks, food handlers, and stewarding staff.',
    category: 'Safety & Hygiene',
    trainer: 'Chef Marco Rossi & Safety Auditor',
    venue: 'Main Culinary Kitchen / Lecture Room 1',
    start_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    start_time: '14:00:00',
    end_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    end_time: '17:00:00',
    capacity: 20,
    budget: 850.00,
    department: 'Kitchen',
    status: 'scheduled'
  }
]

for (const ts of trainingSessions) {
  const existingSession = await pool.query('SELECT id FROM training_sessions WHERE title=$1', [ts.title])
  let sessionId = existingSession.rows[0]?.id
  if (!sessionId) {
    const sessionRes = await pool.query(
      `INSERT INTO training_sessions(
         title, description, category, trainer, venue, start_date, start_time,
         end_date, end_time, capacity, budget, department, status, created_by
       )
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [ts.title, ts.description, ts.category, ts.trainer, ts.venue, ts.start_date, ts.start_time, ts.end_date, ts.end_time, ts.capacity, ts.budget, ts.department, ts.status, adminId]
    )
    sessionId = sessionRes.rows[0]?.id
  }

  if (sessionId) {
    const participantEmpNumbers = ['E007', 'E011', 'E001']
    for (const empNum of participantEmpNumbers) {
      const empId = employeeDbMap[empNum]
      if (empId) {
        await pool.query(
          `INSERT INTO training_participants(session_id, employee_id, invited_by, status, attendance)
           VALUES($1, $2, $3, 'invited', 'pending')
           ON CONFLICT (session_id, employee_id) DO NOTHING`,
          [sessionId, empId, adminId]
        )
      }
    }
  }
}

// 5. Baseline Competency Assessments for Radar Charts & 9-Box Grid
const baselineCompetencies = [
  'Customer Service Excellence',
  'Hospitality SOP Compliance',
  'Safety, Sanitation & HACCP',
  'Team Collaboration & Interdepartmental Comm.',
  'Technical Operational Proficiency',
  'Leadership & Problem Solving'
]

for (const [empNum, empId] of Object.entries(employeeDbMap)) {
  for (const comp of baselineCompetencies) {
    const score = Math.floor(Math.random() * (95 - 75 + 1)) + 75
    await pool.query(
      `INSERT INTO competency_assessments(employee_id, competency, score, required_score, source)
       VALUES($1, $2, $3, 80, 'baseline')
       ON CONFLICT (employee_id, competency) DO UPDATE SET
         score=EXCLUDED.score,
         updated_at=NOW()`,
      [empId, comp, score]
    )
  }
}

console.log('✅ Successfully seeded 25+ hotel employee accounts across all 9 hotel departments!')
console.log('✅ Seeded learning resources, training calendar sessions, and competency baselines.')
console.log('🔑 Universal Demo Password for all accounts: ChangeMe123!')
console.log('\n📋 Quick Role Login Guide:')
console.log('  • HR Administrator:        ava@pds.local')
console.log('  • General Manager:         noah@pds.local')
console.log('  • Operations Director:     samir@pds.local')
console.log('  • Housekeeping Supervisor: anna@pds.local')
console.log('  • Kitchen Executive Chef:  marco@pds.local')
console.log('  • Front Office Manager:    jordan@pds.local')
console.log('  • Room Attendant:          rosa@pds.local')
console.log('  • Lead Waitress:           emily@pds.local')
console.log('  • Receptionist:            maria@pds.local')
console.log('  • Sous Chef:               andre@pds.local')

await pool.end()

