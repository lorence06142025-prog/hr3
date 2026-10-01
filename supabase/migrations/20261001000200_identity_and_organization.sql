-- 1. Departments (normalized)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill departments from existing free-text employee.department values.
INSERT INTO departments (name)
SELECT DISTINCT trim(department) FROM employees
WHERE department IS NOT NULL AND trim(department) <> ''
ON CONFLICT (name) DO NOTHING;

-- Add department_id FK on employees.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Backfill department_id from the department string.
UPDATE employees e
SET department_id = d.id
FROM departments d
WHERE e.department_id IS NULL
  AND e.department IS NOT NULL
  AND trim(e.department) = d.name;

-- 3. Self-service registration invitations

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'employee',
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  employee_id UUID REFERENCES employees(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Sessions table for refresh token tracking & revocation
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, is_revoked, expires_at DESC);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 024_add_two_factor_auth.sql
-- Two-Factor Authentication (TOTP / Google Authenticator) support for users.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NULL,
ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT NULL,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS users_2fa_enabled_idx ON users(two_factor_enabled) WHERE two_factor_enabled = true;

-- Seed a freight and logistics company demo organization.
-- Reuses existing roles: hr, management, operations_manager, supervisor, employee.
-- All demo accounts share the password: ChangeMe123!
-- (bcrypt hash below == bcrypt.hash('ChangeMe123!', 12))

-- ============================================================
-- 1. Departments
-- ============================================================
INSERT INTO departments (name) VALUES
  ('Executive Office'),
  ('Human Resources'),
  ('Fleet & Transportation'),
  ('Dispatch & Routing'),
  ('Warehouse & Inventory'),
  ('Customer Service'),
  ('Safety & Compliance'),
  ('Finance & Administration')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Department heads & managers (seeded first to get their IDs)
-- ============================================================

-- Human Resources Manager (hr)
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E004', 'Ava Reyes', d.name, d.id, 'HR Manager', 90, 90, 88
  FROM departments d WHERE d.name = 'Human Resources'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'ava@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Ava Reyes', 'hr'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- General Manager (management)
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E005', 'Noah Santos', d.name, d.id, 'General Manager', 91, 89, 86
  FROM departments d WHERE d.name = 'Executive Office'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'noah@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Noah Santos', 'management'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Operations Manager (operations_manager)
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E006', 'Samir Patel', d.name, d.id, 'Fleet Operations Manager', 89, 86, 75
  FROM departments d WHERE d.name = 'Fleet & Transportation'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'samir@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Samir Patel', 'operations_manager'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Dispatch Supervisor
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E002', 'Jordan Williams', d.name, d.id, 'Dispatch Supervisor', 86, 88, 82
  FROM departments d WHERE d.name = 'Dispatch & Routing'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'jordan@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Jordan Williams', 'supervisor'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Warehouse Supervisor
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E010', 'Anna Kowalski', d.name, d.id, 'Warehouse Supervisor', 85, 84, 79
  FROM departments d WHERE d.name = 'Warehouse & Inventory'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'anna@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Anna Kowalski', 'supervisor'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Transportation Supervisor
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E013', 'Robert Johnson', d.name, d.id, 'Transportation Supervisor', 84, 84, 71
  FROM departments d WHERE d.name = 'Fleet & Transportation'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'robert@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Robert Johnson', 'supervisor'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Safety & Compliance Manager
WITH e AS (
  INSERT INTO employees (
    employee_number, full_name, department, department_id, job_title,
    performance_score, competency_score, learning_progress
  )
  SELECT 'E017', 'Marco Rossi', d.name, d.id, 'Safety & Compliance Manager', 88, 87, 80
  FROM departments d WHERE d.name = 'Safety & Compliance'
  ON CONFLICT (employee_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    department_id = EXCLUDED.department_id,
    job_title = EXCLUDED.job_title,
    performance_score = EXCLUDED.performance_score,
    competency_score = EXCLUDED.competency_score,
    learning_progress = EXCLUDED.learning_progress
  RETURNING id
)
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'marco@pds.local',
  '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW',
  'Marco Rossi', 'supervisor'
FROM e
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Operating staff report to their functional supervisors.
INSERT INTO employees (
  employee_number, full_name, department, department_id, job_title, manager_id,
  performance_score, competency_score, learning_progress
)
SELECT v.number, v.name, d.name, d.id, v.title, m.id, v.perf, v.comp, v.learn
FROM (VALUES
  ('E001', 'Emily Thompson', 'Customer Service', 'Customer Service Representative', 'E006', 84, 84, 71),
  ('E007', 'Maria Lopez', 'Fleet & Transportation', 'Driver', 'E013', 84, 82, 78),
  ('E008', 'David Kim', 'Fleet & Transportation', 'Heavy Vehicle Driver', 'E013', 80, 81, 74),
  ('E009', 'Sofia Garcia', 'Dispatch & Routing', 'Dispatcher', 'E002', 83, 85, 77),
  ('E011', 'Rosa Martinez', 'Warehouse & Inventory', 'Warehouse Associate', 'E010', 82, 80, 73),
  ('E012', 'Linda Chen', 'Warehouse & Inventory', 'Inventory Control Clerk', 'E010', 81, 79, 72),
  ('E014', 'Chloe Brown', 'Fleet & Transportation', 'Delivery Driver', 'E013', 82, 81, 72),
  ('E015', 'James Wilson', 'Warehouse & Inventory', 'Forklift Operator', 'E010', 83, 80, 70),
  ('E016', 'Grace Lee', 'Dispatch & Routing', 'Route Planner', 'E002', 80, 82, 69),
  ('E018', 'Andre Tan', 'Fleet & Transportation', 'Fleet Coordinator', 'E006', 85, 83, 76),
  ('E019', 'Nina Petrova', 'Safety & Compliance', 'Safety Coordinator', 'E017', 80, 78, 70)
) AS v(number, name, department_name, title, manager_number, perf, comp, learn)
JOIN departments d ON d.name = v.department_name
JOIN employees m ON m.employee_number = v.manager_number
ON CONFLICT (employee_number) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  department_id = EXCLUDED.department_id,
  job_title = EXCLUDED.job_title,
  manager_id = EXCLUDED.manager_id,
  performance_score = EXCLUDED.performance_score,
  competency_score = EXCLUDED.competency_score,
  learning_progress = EXCLUDED.learning_progress;

-- ============================================================
-- 4. Demo user accounts for line employees
-- ============================================================
INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'maria@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Maria Lopez', 'employee'
FROM employees WHERE employee_number = 'E007'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'david@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'David Kim', 'employee'
FROM employees WHERE employee_number = 'E008'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'sofia@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Sofia Garcia', 'employee'
FROM employees WHERE employee_number = 'E009'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'rosa@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Rosa Martinez', 'employee'
FROM employees WHERE employee_number = 'E011'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'linda@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Linda Chen', 'employee'
FROM employees WHERE employee_number = 'E012'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'emily@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Emily Thompson', 'employee'
FROM employees WHERE employee_number = 'E001'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'chloe@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Chloe Brown', 'employee'
FROM employees WHERE employee_number = 'E014'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'james@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'James Wilson', 'employee'
FROM employees WHERE employee_number = 'E015'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'grace@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Grace Lee', 'employee'
FROM employees WHERE employee_number = 'E016'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'andre@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Andre Tan', 'employee'
FROM employees WHERE employee_number = 'E018'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

INSERT INTO users (employee_id, email, password_hash, full_name, role)
SELECT id, 'nina@pds.local', '$2a$12$f8ej.p03oxiLLP79wgwSVe51ZcPCDLgH6BgUEi4haLRFlC43vbqRW', 'Nina Petrova', 'employee'
FROM employees WHERE employee_number = 'E019'
ON CONFLICT (email) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;
