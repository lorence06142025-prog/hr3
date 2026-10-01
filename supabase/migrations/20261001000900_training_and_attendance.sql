-- 022_training_sessions.sql
-- Session-based Training Management System
--
-- Dedicated tables for training sessions and training participants.
-- Training sessions serve as the single source of truth for the Training Calendar,
-- participant lists, attendance tracking, evaluations, analytics, and AI insights.

-- 1. Training Sessions Table
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  trainer TEXT,
  venue TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_date DATE,
  end_time TIME,
  capacity INT NOT NULL DEFAULT 30 CHECK (capacity > 0),
  budget NUMERIC(10,2) DEFAULT 0.00,
  department TEXT DEFAULT 'All Departments',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_sessions_date_idx ON training_sessions(start_date, status);
CREATE INDEX IF NOT EXISTS training_sessions_status_idx ON training_sessions(status);
CREATE INDEX IF NOT EXISTS training_sessions_category_idx ON training_sessions(category);

-- 2. Training Participants Table
CREATE TABLE IF NOT EXISTS training_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'declined', 'completed')),
  attendance TEXT NOT NULL DEFAULT 'pending' CHECK (attendance IN ('pending', 'present', 'absent', 'late', 'excused')),
  attendance_recorded_at TIMESTAMPTZ,
  attendance_recorded_by UUID REFERENCES users(id),
  evaluation JSONB DEFAULT '{}'::jsonb,
  evaluation_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, employee_id)
);

CREATE INDEX IF NOT EXISTS training_participants_session_idx ON training_participants(session_id, status);
CREATE INDEX IF NOT EXISTS training_participants_employee_idx ON training_participants(employee_id, status);
CREATE INDEX IF NOT EXISTS training_participants_attendance_idx ON training_participants(session_id, attendance);

-- 029_hr2_attendance.sql
-- Table to store synced biometric / Daily Time Record (DTR) attendance logs from HR2.
-- Feeds objective attendance scoring into Performance Management evaluations and unlocks
-- Perfect Attendance social recognition.

CREATE TABLE IF NOT EXISTS hr2_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'Q1 2026',
  total_working_days INT NOT NULL DEFAULT 60 CHECK (total_working_days > 0),
  days_present INT NOT NULL DEFAULT 60 CHECK (days_present >= 0 AND days_present <= total_working_days),
  days_absent INT NOT NULL DEFAULT 0 CHECK (days_absent >= 0),
  tardy_count INT NOT NULL DEFAULT 0 CHECK (tardy_count >= 0),
  tardy_minutes INT NOT NULL DEFAULT 0 CHECK (tardy_minutes >= 0),
  attendance_score NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (attendance_score BETWEEN 0 AND 100),
  is_perfect_attendance BOOLEAN NOT NULL DEFAULT false,
  sync_source TEXT NOT NULL DEFAULT 'HR2_BIOMETRIC_API',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, period)
);

CREATE INDEX IF NOT EXISTS hr2_attendance_employee_idx ON hr2_attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS hr2_attendance_period_idx ON hr2_attendance_records(period);
CREATE INDEX IF NOT EXISTS hr2_attendance_perfect_idx ON hr2_attendance_records(is_perfect_attendance);

-- Seed realistic Q1 2026 attendance records for all active employees
-- Generating diverse realistic data (some perfect attendance, some minor tardiness, etc.)
INSERT INTO hr2_attendance_records (
  employee_id,
  period,
  total_working_days,
  days_present,
  days_absent,
  tardy_count,
  tardy_minutes,
  attendance_score,
  is_perfect_attendance,
  sync_source,
  synced_at
)
SELECT
  e.id,
  'Q1 2026' AS period,
  60 AS total_working_days,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN 60 -- Perfect Attendance (20%)
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 1) THEN 59 -- 1 absence
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 2) THEN 58 -- 2 absences
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 3) THEN 60 -- 0 absences, 2 lates
    ELSE 57 -- 3 absences
  END AS days_present,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN 0
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 1) THEN 1
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 2) THEN 2
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 3) THEN 0
    ELSE 3
  END AS days_absent,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN 0
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 3) THEN 2
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 4) THEN 3
    ELSE 1
  END AS tardy_count,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN 0
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 3) THEN 25
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 4) THEN 40
    ELSE 10
  END AS tardy_minutes,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN 100.00
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 1) THEN 97.50
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 2) THEN 94.00
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 3) THEN 96.50
    ELSE 90.00
  END AS attendance_score,
  CASE
    WHEN (('x' || substring(e.id::text, 1, 4))::bit(16)::int % 5 = 0) THEN true
    ELSE false
  END AS is_perfect_attendance,
  'HR2_BIOMETRIC_API' AS sync_source,
  NOW() AS synced_at
FROM employees e
WHERE e.is_active = true
ON CONFLICT (employee_id, period) DO NOTHING;

-- 030_seed_q2_and_annual_attendance.sql
-- Seeds realistic attendance records for 'Q2 2026' (Apr-Jun, 60 days)
-- and 'Annual 2026' (Full year, 240 days) for all active employees.

-- 1. Seed Q2 2026 (Quarter 2: 60 working days)
INSERT INTO hr2_attendance_records (
  employee_id,
  period,
  total_working_days,
  days_present,
  days_absent,
  tardy_count,
  tardy_minutes,
  attendance_score,
  is_perfect_attendance,
  sync_source,
  synced_at
)
SELECT
  e.id,
  'Q2 2026' AS period,
  60 AS total_working_days,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 60 -- Hexa 100% Perfect Attendance
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN 60 -- Perfect Attendance (100%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 1) THEN 59 -- 1 absence (98.33%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 2) THEN 59 -- 1 absence, 1 late (96.67%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 3) THEN 60 -- 0 absences, 2 lates (96.50%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 4) THEN 58 -- 2 absences, 1 late (94.00%)
    ELSE 57 -- 3 absences, 2 lates (89.50%)
  END AS days_present,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 1) THEN 1
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 2) THEN 1
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 3) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 4) THEN 2
    ELSE 3
  END AS days_absent,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 1) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 2) THEN 1
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 3) THEN 2
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 4) THEN 1
    ELSE 2
  END AS tardy_count,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 1) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 2) THEN 15
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 3) THEN 25
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 4) THEN 15
    ELSE 30
  END AS tardy_minutes,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 100.00
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN 100.00
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 1) THEN 98.33
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 2) THEN 96.67
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 3) THEN 96.50
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 4) THEN 94.00
    ELSE 89.50
  END AS attendance_score,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN true
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 2) % 6 = 0) THEN true
    ELSE false
  END AS is_perfect_attendance,
  'HR2_BIOMETRIC_API' AS sync_source,
  NOW() AS synced_at
FROM employees e
WHERE e.is_active = true
ON CONFLICT (employee_id, period) DO UPDATE SET
  total_working_days = EXCLUDED.total_working_days,
  days_present = EXCLUDED.days_present,
  days_absent = EXCLUDED.days_absent,
  tardy_count = EXCLUDED.tardy_count,
  tardy_minutes = EXCLUDED.tardy_minutes,
  attendance_score = EXCLUDED.attendance_score,
  is_perfect_attendance = EXCLUDED.is_perfect_attendance,
  sync_source = EXCLUDED.sync_source,
  synced_at = NOW();

-- 2. Seed Annual 2026 (Full Year: 240 working days)
INSERT INTO hr2_attendance_records (
  employee_id,
  period,
  total_working_days,
  days_present,
  days_absent,
  tardy_count,
  tardy_minutes,
  attendance_score,
  is_perfect_attendance,
  sync_source,
  synced_at
)
SELECT
  e.id,
  'Annual 2026' AS period,
  240 AS total_working_days,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 240 -- Hexa 100% Perfect Attendance
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN 240 -- Perfect Attendance (100%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 1) THEN 238 -- 2 absences (98.80%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 2) THEN 235 -- 5 absences, 3 lates (96.50%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 3) THEN 237 -- 3 absences, 4 lates (96.80%)
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 4) THEN 232 -- 8 absences, 5 lates (93.50%)
    ELSE 228 -- 12 absences, 6 lates (89.00%)
  END AS days_present,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 1) THEN 2
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 2) THEN 5
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 3) THEN 3
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 4) THEN 8
    ELSE 12
  END AS days_absent,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 1) THEN 1
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 2) THEN 3
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 3) THEN 4
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 4) THEN 5
    ELSE 6
  END AS tardy_count,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN 0
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 1) THEN 10
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 2) THEN 45
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 3) THEN 60
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 4) THEN 75
    ELSE 90
  END AS tardy_minutes,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN 100.00
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN 100.00
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 1) THEN 98.80
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 2) THEN 96.50
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 3) THEN 96.80
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 4) THEN 93.50
    ELSE 89.00
  END AS attendance_score,
  CASE
    WHEN LOWER(e.full_name) LIKE '%hexa%' THEN true
    WHEN ((('x' || substring(e.id::text, 1, 4))::bit(16)::int + 4) % 6 = 0) THEN true
    ELSE false
  END AS is_perfect_attendance,
  'HR2_BIOMETRIC_API' AS sync_source,
  NOW() AS synced_at
FROM employees e
WHERE e.is_active = true
ON CONFLICT (employee_id, period) DO UPDATE SET
  total_working_days = EXCLUDED.total_working_days,
  days_present = EXCLUDED.days_present,
  days_absent = EXCLUDED.days_absent,
  tardy_count = EXCLUDED.tardy_count,
  tardy_minutes = EXCLUDED.tardy_minutes,
  attendance_score = EXCLUDED.attendance_score,
  is_perfect_attendance = EXCLUDED.is_perfect_attendance,
  sync_source = EXCLUDED.sync_source,
  synced_at = NOW();
