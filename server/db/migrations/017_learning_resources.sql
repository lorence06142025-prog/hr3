-- 017_learning_resources.sql
-- Learning Resource / Course Library.
--
-- Purpose: give HR a legitimate source of where learning modules/courses come
-- from, clearly separating COURSE/RESOURCE information from ASSIGNMENT, from
-- PROGRESS, and from COMPLETION/ASSESSMENT. "Completion" is ONLY ever recorded
-- in learning_completions so AI insights can never claim an employee completed
-- a course without a corresponding completion record.

-- ============================================================
-- 1. Learning resources (the course/library catalog)
--    Internal => company training/materials; External => providers,
--    TESDA, online learning, HR-recommended programs, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT,
  provider_type TEXT NOT NULL DEFAULT 'internal' CHECK (provider_type IN ('internal','external')),
  duration_hours NUMERIC(6,2),
  objectives TEXT,
  url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learning_resources_active_idx ON learning_resources(is_active, category);

-- ============================================================
-- 2. Resource <-> competency association (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_resource_competencies (
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  competency TEXT NOT NULL,
  PRIMARY KEY (resource_id, competency)
);
CREATE INDEX IF NOT EXISTS learning_resource_comp_competency_idx ON learning_resource_competencies(competency);

-- ============================================================
-- 3. Assignments (HR assigns a resource to an employee)
--    Assignment is SEPARATE from completion.
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed')),
  progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  UNIQUE (resource_id, employee_id)
);
CREATE INDEX IF NOT EXISTS learning_assignments_emp_idx ON learning_assignments(employee_id, status);
CREATE INDEX IF NOT EXISTS learning_assignments_resource_idx ON learning_assignments(resource_id);

-- ============================================================
-- 4. Completions — the ONLY source of truth that an employee
--    actually COMPLETED a course. Includes assessment result.
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  assignment_id UUID REFERENCES learning_assignments(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assessment_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_id, employee_id)
);
CREATE INDEX IF NOT EXISTS learning_completions_emp_idx ON learning_completions(employee_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS learning_completions_resource_idx ON learning_completions(resource_id);
