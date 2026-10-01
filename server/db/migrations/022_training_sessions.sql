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
