import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const passwordHash = await bcrypt.hash('ChangeMe123!', 12)
const departments = [
  'Executive Office',
  'Human Resources',
  'Fleet & Transportation',
  'Dispatch & Routing',
  'Warehouse & Inventory',
  'Customer Service',
  'Safety & Compliance',
  'Finance & Administration',
]

for (const name of departments) {
  await pool.query('INSERT INTO departments(name) VALUES($1) ON CONFLICT(name) DO NOTHING', [name])
}

const staffProfiles = [
  { number: 'E005', name: 'Noah Santos', department: 'Executive Office', title: 'General Manager', role: 'management', email: 'noahpriorityph@gmail.com', performance: 94, competency: 92, learning: 89 },
  { number: 'E004', name: 'Ava Reyes', department: 'Human Resources', title: 'HR Administrator', role: 'hr', email: 'avapriorityph@gmail.com', manager: 'E005', performance: 92, competency: 90, learning: 88 },
  { number: 'E006', name: 'Samir Patel', department: 'Fleet & Transportation', title: 'Fleet Operations Manager', role: 'operations_manager', email: 'samirpriorityph@gmail.com', manager: 'E005', performance: 90, competency: 88, learning: 85 },
  { number: 'E002', name: 'Jordan Williams', department: 'Dispatch & Routing', title: 'Dispatch Supervisor', role: 'supervisor', email: 'jordanpriorityph@gmail.com', manager: 'E006', performance: 88, competency: 88, learning: 82 },
  { number: 'E010', name: 'Anna Kowalski', department: 'Warehouse & Inventory', title: 'Warehouse Supervisor', role: 'supervisor', email: 'annapriorityph@gmail.com', manager: 'E006', performance: 86, competency: 85, learning: 80 },
  { number: 'E013', name: 'Robert Johnson', department: 'Fleet & Transportation', title: 'Transportation Supervisor', role: 'supervisor', email: 'robertpriorityph@gmail.com', manager: 'E006', performance: 87, competency: 86, learning: 82 },
  { number: 'E017', name: 'Marco Rossi', department: 'Safety & Compliance', title: 'Safety & Compliance Manager', role: 'supervisor', email: 'marcopriorityph@gmail.com', manager: 'E006', performance: 91, competency: 89, learning: 84 },
  { number: 'E001', name: 'Emily Thompson', department: 'Customer Service', title: 'Customer Service Representative', role: 'employee', email: 'emilypriorityph@gmail.com', manager: 'E006', performance: 85, competency: 84, learning: 76 },
  { number: 'E007', name: 'Maria Lopez', department: 'Fleet & Transportation', title: 'Driver', role: 'employee', email: 'mariapriorityph@gmail.com', manager: 'E013', performance: 86, competency: 84, learning: 80 },
  { number: 'E008', name: 'David Kim', department: 'Fleet & Transportation', title: 'Heavy Vehicle Driver', role: 'employee', email: 'davidpriorityph@gmail.com', manager: 'E013', performance: 82, competency: 81, learning: 75 },
  { number: 'E009', name: 'Sofia Garcia', department: 'Dispatch & Routing', title: 'Dispatcher', role: 'employee', email: 'sofiapriorityph@gmail.com', manager: 'E002', performance: 85, competency: 87, learning: 79 },
  { number: 'E011', name: 'Rosa Martinez', department: 'Warehouse & Inventory', title: 'Warehouse Associate', role: 'employee', email: 'rosapriorityph@gmail.com', manager: 'E010', performance: 92, competency: 85, learning: 78 },
  { number: 'E012', name: 'Linda Chen', department: 'Warehouse & Inventory', title: 'Inventory Control Clerk', role: 'employee', email: 'lindapriorityph@gmail.com', manager: 'E010', performance: 83, competency: 80, learning: 74 },
  { number: 'E014', name: 'Chloe Brown', department: 'Fleet & Transportation', title: 'Delivery Driver', role: 'employee', email: 'chloepriorityph@gmail.com', manager: 'E013', performance: 81, competency: 80, learning: 71 },
  { number: 'E015', name: 'James Wilson', department: 'Warehouse & Inventory', title: 'Forklift Operator', role: 'employee', email: 'jamespriorityph@gmail.com', manager: 'E010', performance: 86, competency: 85, learning: 75 },
  { number: 'E016', name: 'Grace Lee', department: 'Dispatch & Routing', title: 'Route Planner', role: 'employee', email: 'gracepriorityph@gmail.com', manager: 'E002', performance: 84, competency: 82, learning: 73 },
  { number: 'E018', name: 'Andre Tan', department: 'Fleet & Transportation', title: 'Fleet Coordinator', role: 'employee', email: 'andrepriorityph@gmail.com', manager: 'E006', performance: 88, competency: 86, learning: 80 },
  { number: 'E019', name: 'Nina Petrova', department: 'Safety & Compliance', title: 'Safety Coordinator', role: 'employee', email: 'ninapriorityph@gmail.com', manager: 'E017', performance: 85, competency: 84, learning: 77 },
]

const employeeDbMap = new Map()
for (const employee of staffProfiles) {
  const manager = employee.manager
    ? (await pool.query('SELECT id FROM employees WHERE employee_number = $1', [employee.manager])).rows[0]
    : null
  const result = await pool.query(
    `INSERT INTO employees (
       employee_number, full_name, department, department_id, job_title, manager_id,
       performance_score, competency_score, learning_progress
     ) VALUES (
       $1, $2, $3, (SELECT id FROM departments WHERE name = $3), $4, $5, $6, $7, $8
     )
     ON CONFLICT (employee_number) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       department = EXCLUDED.department,
       department_id = EXCLUDED.department_id,
       job_title = EXCLUDED.job_title,
       manager_id = EXCLUDED.manager_id,
       performance_score = EXCLUDED.performance_score,
       competency_score = EXCLUDED.competency_score,
       learning_progress = EXCLUDED.learning_progress
     RETURNING id`,
    [employee.number, employee.name, employee.department, employee.title, manager?.id || null, employee.performance, employee.competency, employee.learning]
  )
  const employeeId = result.rows[0].id
  employeeDbMap.set(employee.number, employeeId)
  await pool.query(
    `INSERT INTO users (employee_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id) DO UPDATE SET
       email = EXCLUDED.email,
       employee_id = EXCLUDED.employee_id,
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       is_active = true`,
    [employeeId, employee.email, passwordHash, employee.name, employee.role]
  )
}

const learningResources = [
  { title: 'Defensive Driving & Hours-of-Service Compliance', category: 'Fleet Safety', duration: 6, competencies: ['Defensive Driving', 'Regulatory Compliance'] },
  { title: 'Pre-Trip and Post-Trip Vehicle Inspection', category: 'Fleet Safety', duration: 3, competencies: ['Vehicle Inspection & Preventive Checks'] },
  { title: 'Cargo Securement and Load Restraint', category: 'Fleet Operations', duration: 4, competencies: ['Cargo Securement'] },
  { title: 'Driver Fatigue and Journey Risk Management', category: 'Fleet Safety', duration: 3, competencies: ['Risk Assessment', 'Defensive Driving'] },
  { title: 'Fuel-Efficient Driving and Vehicle Care', category: 'Fleet Operations', duration: 3, competencies: ['Fuel-Efficient Operations'] },
  { title: 'TMS and GPS Dispatch Fundamentals', category: 'Dispatch & Routing', duration: 4, competencies: ['TMS & GPS Proficiency', 'Dispatch Communication'] },
  { title: 'Route Planning and Delivery Window Optimization', category: 'Dispatch & Routing', duration: 5, competencies: ['Route Planning & Optimization'] },
  { title: 'Load Scheduling and Capacity Planning', category: 'Dispatch & Routing', duration: 4, competencies: ['Load Scheduling'] },
  { title: 'Dispatch Exceptions and Delay Recovery', category: 'Dispatch & Routing', duration: 3, competencies: ['Exception Management'] },
  { title: 'Fleet Maintenance Planning and Downtime Reduction', category: 'Fleet Maintenance', duration: 5, competencies: ['Vehicle Inspection & Preventive Checks'] },
  { title: 'Warehouse Safety and Incident Reporting', category: 'Warehouse Operations', duration: 3, competencies: ['Warehouse Safety', 'Incident Reporting'] },
  { title: 'Forklift Operator Safety and Load Stability', category: 'Warehouse Operations', duration: 4, competencies: ['Forklift Operation & Safety'] },
  { title: 'Freight Receiving, Scanning and Inventory Accuracy', category: 'Warehouse Operations', duration: 3, competencies: ['Inventory Accuracy', 'WMS Proficiency'] },
  { title: 'Order Picking, Packing and Shipment Staging', category: 'Warehouse Operations', duration: 3, competencies: ['Picking & Packing'] },
  { title: 'WMS Cycle Counting and Inventory Reconciliation', category: 'Warehouse Operations', duration: 4, competencies: ['WMS Proficiency', 'Inventory Accuracy'] },
  { title: 'Freight Customer Service and Shipment Visibility', category: 'Customer Service', duration: 3, competencies: ['Shipment Tracking', 'Customer Communication'] },
  { title: 'Proof of Delivery, Returns and Claims Evidence', category: 'Customer Service', duration: 3, competencies: ['Proof-of-Delivery Accuracy', 'Claims Resolution'] },
  { title: 'Freight Claims Handling and Damage Prevention', category: 'Customer Service', duration: 4, competencies: ['Claims Resolution', 'Cargo Securement'] },
  { title: 'Incident Investigation and Corrective Action', category: 'Safety & Compliance', duration: 4, competencies: ['Incident Reporting', 'Risk Assessment'] },
  { title: 'Transportation Regulations and Document Control', category: 'Safety & Compliance', duration: 4, competencies: ['Regulatory Compliance', 'Documentation Accuracy'] },
  { title: 'Driver Coaching and Safety Leadership', category: 'Safety & Compliance', duration: 5, competencies: ['Driver Coaching', 'Leadership'] },
  { title: 'Freight Billing, Rating and Invoice Auditing', category: 'Finance & Administration', duration: 4, competencies: ['Freight Billing & Audit'] },
  { title: 'Frontline Leadership for Logistics Supervisors', category: 'Leadership & People', duration: 6, competencies: ['Leadership', 'Operational Management'] },
  { title: 'Employee Onboarding and Driver Qualification', category: 'Human Resources', duration: 4, competencies: ['Recruitment & Selection', 'Labor Compliance'] },
]

const admin = (await pool.query("SELECT id FROM users WHERE role = 'hr' ORDER BY created_at LIMIT 1")).rows[0]?.id || null
for (const resource of learningResources) {
  let resourceId = (await pool.query('SELECT id FROM learning_resources WHERE title = $1', [resource.title])).rows[0]?.id
  if (!resourceId) {
    resourceId = (await pool.query(
      `INSERT INTO learning_resources (title, description, category, provider, provider_type, duration_hours, objectives, created_by)
       VALUES ($1, $2, $3, 'Priority Logistics Learning', 'internal', $4, $5, $6)
       RETURNING id`,
      [resource.title, `Role-focused freight and logistics training: ${resource.title}.`, resource.category, resource.duration, `Build practical skills in ${resource.competencies.join(', ')}.`, admin]
    )).rows[0].id
  }
  for (const competency of resource.competencies) {
    await pool.query(
      `INSERT INTO learning_resource_competencies (resource_id, competency)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [resourceId, competency]
    )
  }
}

const trainingSessions = [
  { title: 'Driver Safety and Pre-Trip Inspection', description: 'Hands-on defensive driving, vehicle inspection, cargo securement, and incident reporting.', category: 'Fleet Safety', trainer: 'Marco Rossi, Safety & Compliance Manager', venue: 'Fleet Yard Training Bay', days: 2, start: '09:00:00', end: '12:00:00', capacity: 18, budget: 900, department: 'Fleet & Transportation', employees: ['E007', 'E008', 'E014'] },
  { title: 'Dispatch TMS, GPS Routing and Exception Management', description: 'Practical route planning, load scheduling, live tracking, and delivery exception exercises.', category: 'Dispatch & Routing', trainer: 'Jordan Williams, Dispatch Supervisor', venue: 'Dispatch Operations Room', days: 4, start: '13:00:00', end: '16:00:00', capacity: 12, budget: 650, department: 'Dispatch & Routing', employees: ['E009', 'E016'] },
  { title: 'Warehouse Forklift Safety and Cargo Securement', description: 'Safe powered-truck operation, freight staging, inventory scanning, and load stability.', category: 'Warehouse Operations', trainer: 'Anna Kowalski, Warehouse Supervisor', venue: 'Warehouse Training Area', days: 6, start: '09:00:00', end: '12:00:00', capacity: 16, budget: 750, department: 'Warehouse & Inventory', employees: ['E011', 'E012', 'E015'] },
  { title: 'Shipment Visibility, Proof of Delivery and Claims', description: 'Shipment status communication, proof-of-delivery accuracy, returns, and claims evidence.', category: 'Customer Service', trainer: 'Ava Reyes, HR Administrator', venue: 'Operations Training Room', days: 8, start: '10:00:00', end: '13:00:00', capacity: 14, budget: 500, department: 'Customer Service', employees: ['E001', 'E009'] },
]

for (const session of trainingSessions) {
  const startDate = new Date(Date.now() + 86400000 * session.days).toISOString().slice(0, 10)
  const existing = (await pool.query('SELECT id FROM training_sessions WHERE title = $1', [session.title])).rows[0]?.id
  let sessionId = existing
  if (!sessionId) {
    sessionId = (await pool.query(
      `INSERT INTO training_sessions (
         title, description, category, trainer, venue, start_date, start_time,
         end_date, end_time, capacity, budget, department, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $8, $9, $10, $11, 'scheduled', $12)
       RETURNING id`,
      [session.title, session.description, session.category, session.trainer, session.venue, startDate, session.start, session.end, session.capacity, session.budget, session.department, admin]
    )).rows[0].id
  }
  for (const employeeNumber of session.employees) {
    const employeeId = employeeDbMap.get(employeeNumber)
    if (employeeId) {
      await pool.query(
        `INSERT INTO training_participants (session_id, employee_id, invited_by, status, attendance)
         VALUES ($1, $2, $3, 'invited', 'pending') ON CONFLICT (session_id, employee_id) DO NOTHING`,
        [sessionId, employeeId, admin]
      )
    }
  }
}

console.log('Seeded the freight/logistics demo organization, role-focused learning library, and sample training sessions.')
console.log('Demo password for seeded accounts: ChangeMe123!')
await pool.end()

