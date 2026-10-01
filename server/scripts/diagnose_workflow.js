import { pool } from '../src/db.js'
import { stagesFor, nextStage } from '../src/workflow.js'

// Verify HR user and employee records
const hr = await pool.query(
  "SELECT u.id, u.role, u.employee_id, e.full_name, e.department FROM users u LEFT JOIN employees e ON e.id = u.employee_id WHERE u.email = 'ava@pds.local'"
)
console.log('HR user:', hr.rows[0])

const employees = await pool.query('SELECT id, full_name, department FROM employees WHERE is_active = true LIMIT 5')
console.log('Sample employees:', employees.rows)

// Test stage flows for each module as HR
const modules = ['performance', 'competency', 'learning', 'training', 'succession', 'recognition']
for (const module of modules) {
  const stages = stagesFor(module)
  const [firstKey, firstLabel, firstRoles] = stages[0]
  console.log(`\n${module}: first stage "${firstKey}" (${firstLabel}) assigned to:`, firstRoles.join(', '))
  if (firstRoles.includes('hr')) {
    console.log('  -> HR can start this cycle ✓')
  } else {
    console.log('  -> HR CANNOT start this cycle ✗ (requires: ' + firstRoles.join(', ') + ')')
  }
}

await pool.end()
