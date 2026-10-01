import { query } from '../db.js'

/**
 * Resolve the user's assigned department and department_id from the DB
 * using their linked employee record (users.employee_id -> employees.department).
 */
export async function getUserDepartment(user) {
  if (!user) return { department: null, department_id: null }
  if (user.department && user.departmentId) {
    return { department: user.department, department_id: user.departmentId }
  }
  if (!user.employeeId) return { department: null, department_id: null }

  const { rows } = await query(
    'SELECT department, department_id FROM employees WHERE id = $1 AND is_active = true',
    [user.employeeId]
  )
  const emp = rows[0]
  return {
    department: emp?.department || null,
    department_id: emp?.department_id || null,
  }
}

/**
 * Get comprehensive scoping information for an authenticated user.
 */
export async function getScopeFilter(user) {
  if (!user) {
    return { isHr: false, isScoped: true, isEmployee: false, department: null, departmentId: null, employeeId: null }
  }
  if (user.role === 'hr') {
    return { isHr: true, isScoped: false, isEmployee: false, department: null, departmentId: null, employeeId: null }
  }
  
  const userDept = await getUserDepartment(user)

  if (user.role === 'supervisor' || user.role === 'operations_manager') {
    return {
      isHr: false,
      isScoped: true,
      isEmployee: false,
      department: userDept.department,
      departmentId: userDept.department_id,
      employeeId: user.employeeId || null,
    }
  }

  if (user.role === 'employee') {
    return {
      isHr: false,
      isScoped: true,
      isEmployee: true,
      department: userDept.department,
      departmentId: userDept.department_id,
      employeeId: user.employeeId,
    }
  }

  // Management / Senior Manager (executive read-only org-wide scope)
  return {
    isHr: false,
    isScoped: false,
    isEmployee: false,
    isManagement: true,
    department: userDept.department,
    departmentId: userDept.department_id,
    employeeId: user.employeeId || null,
  }
}

/**
 * Enforce that the authenticated user can access the target employee.
 * HR -> Organization-wide
 * Supervisor -> Target employee must belong to supervisor's assigned department
 * Employee -> Can only access own record
 */
export async function verifyEmployeeAccess(user, targetEmployeeId) {
  if (!user) {
    throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  }
  if (!targetEmployeeId) {
    throw Object.assign(new Error('Target employee ID is required.'), { status: 400 })
  }

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(targetEmployeeId))
  const { rows } = await query(
    isUuid
      ? 'SELECT id, full_name, department, department_id, employee_number, is_active FROM employees WHERE id::text = $1 OR employee_number = $1'
      : 'SELECT id, full_name, department, department_id, employee_number, is_active FROM employees WHERE employee_number = $1',
    [targetEmployeeId]
  )
  const targetEmployee = rows[0]
  if (!targetEmployee) {
    throw Object.assign(new Error('Employee not found.'), { status: 404 })
  }

  if (user.role === 'hr' || user.role === 'management') {
    return targetEmployee
  }

  if (user.role === 'employee') {
    if (targetEmployee.id !== user.employeeId && targetEmployee.employee_number !== user.employeeId) {
      throw Object.assign(new Error('Access denied: You can only access your own employee records.'), { status: 403 })
    }
    return targetEmployee
  }

  if (user.role === 'supervisor' || user.role === 'operations_manager') {
    const userDept = await getUserDepartment(user)
    if (!userDept.department) {
      throw Object.assign(new Error('Access denied: Your account requires an assigned department.'), { status: 403 })
    }
    if (targetEmployee.department !== userDept.department) {
      throw Object.assign(new Error(`Access denied: Target employee belongs to the ${targetEmployee.department} department, which is outside your assigned department (${userDept.department}).`), { status: 403 })
    }
    return targetEmployee
  }

  if (user.role === 'management') {
    return targetEmployee
  }

  throw Object.assign(new Error('You do not have access to this employee.'), { status: 403 })
}

/**
 * Enforce that the authenticated user can access/manipulate the target workflow.
 * HR -> Organization-wide
 * Supervisor -> Subject employee must belong to supervisor's assigned department
 * Employee -> Subject employee must be self
 */
export async function verifyWorkflowAccess(user, workflowId) {
  if (!user) {
    throw Object.assign(new Error('Authentication is required.'), { status: 401 })
  }
  if (!workflowId) {
    throw Object.assign(new Error('Workflow ID is required.'), { status: 400 })
  }

  const { rows } = await query(
    `SELECT w.*, e.department AS subject_department, e.full_name AS subject_name
     FROM workflows w
     LEFT JOIN employees e ON e.id = w.subject_employee_id
     WHERE w.id = $1`,
    [workflowId]
  )
  const workflow = rows[0]
  if (!workflow) {
    throw Object.assign(new Error('Workflow not found.'), { status: 404 })
  }

  if (user.role === 'hr') {
    return workflow
  }

  if (user.role === 'employee') {
    if (workflow.subject_employee_id !== user.employeeId) {
      throw Object.assign(new Error('Access denied: You can only view and manage your own workflows.'), { status: 403 })
    }
    return workflow
  }

  if (user.role === 'supervisor' || user.role === 'operations_manager') {
    const userDept = await getUserDepartment(user)
    if (!userDept.department) {
      throw Object.assign(new Error('Access denied: Your account requires an assigned department.'), { status: 403 })
    }
    // Check if the workflow subject employee belongs to supervisor's department
    if (workflow.subject_employee_id) {
      if (workflow.subject_department !== userDept.department) {
        throw Object.assign(new Error(`Access denied: Target workflow subject belongs to the ${workflow.subject_department || 'other'} department, which is outside your assigned department (${userDept.department}).`), { status: 403 })
      }
    } else {
      // If no subject employee is linked, supervisor must be the creator
      if (workflow.created_by !== user.sub) {
        throw Object.assign(new Error('Access denied: Workflow belongs to another department.'), { status: 403 })
      }
    }
    return workflow
  }

  if (user.role === 'management') {
    return workflow
  }

  throw Object.assign(new Error('Access denied to this workflow.'), { status: 403 })
}
