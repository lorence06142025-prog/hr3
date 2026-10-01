WITH management_employee AS (
  INSERT INTO employees (
    employee_number,
    full_name,
    department,
    job_title,
    performance_score,
    competency_score,
    learning_progress
  )
  VALUES (
    'E005',
    'Noah Santos',
    'Executive Office',
    'Senior Operations Manager',
    91,
    89,
    86
  )
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (
  employee_id,
  email,
  password_hash,
  full_name,
  role,
  is_active
)
SELECT
  id,
  'noah@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Noah Santos',
  'management',
  true
FROM management_employee
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

WITH manager_employee AS (
  INSERT INTO employees (
    employee_number,
    full_name,
    department,
    job_title,
    performance_score,
    competency_score,
    learning_progress
  )
  VALUES (
    'E006',
    'Samir Patel',
    'Operations',
    'Operations Manager',
    89,
    86,
    75
  )
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (
  employee_id,
  email,
  password_hash,
  full_name,
  role,
  is_active
)
SELECT
  id,
  'samir@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Samir Patel',
  'operations_manager',
  true
FROM manager_employee
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;