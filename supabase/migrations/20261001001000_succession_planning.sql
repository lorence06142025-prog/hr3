-- 027_succession_planning_redesign.sql
-- Succession Planning Workflow Redesign:
-- 1. Positions table: system-defined job roles with required competencies and critical role flags
-- 2. Position History table: preserves historical employee position progression
-- 3. Succession Records table: audit trail of historical succession assessments and review outcomes

-- ============================================================
-- 1. Positions (Job Titles / Roles Catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  required_competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_learning JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_performance_score NUMERIC(5,2) NOT NULL DEFAULT 70,
  min_competency_score NUMERIC(5,2) NOT NULL DEFAULT 70,
  min_learning_progress NUMERIC(5,2) NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS positions_dept_idx ON positions(department);
CREATE INDEX IF NOT EXISTS positions_critical_idx ON positions(is_critical);

-- ============================================================
-- 2. Position History
-- ============================================================
CREATE TABLE IF NOT EXISTS position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_position TEXT NOT NULL,
  new_position TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL DEFAULT 'Approved Succession',
  approved_by UUID REFERENCES users(id),
  succession_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS position_history_emp_idx ON position_history(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS position_history_workflow_idx ON position_history(succession_workflow_id);

-- ============================================================
-- 3. Succession Records (Historical succession assessments & reviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS succession_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  current_position TEXT NOT NULL,
  recommended_position TEXT,
  readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  readiness_band TEXT NOT NULL DEFAULT 'development_needed' CHECK (readiness_band IN ('ready_now', 'ready_in_1_2_years', 'development_needed')),
  ai_assessment TEXT,
  ai_recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  development_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  development_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'returned', 'rejected')),
  reviewer_id UUID REFERENCES users(id),
  approval_date TIMESTAMPTZ,
  final_approved_position TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS succession_records_emp_idx ON succession_records(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS succession_records_workflow_idx ON succession_records(workflow_id);
CREATE INDEX IF NOT EXISTS succession_records_status_idx ON succession_records(review_status);

-- ============================================================
-- 4. Seed Positions catalog with actual hotel job positions
-- ============================================================
INSERT INTO positions (title, department, is_critical, description, required_competencies, required_learning, min_performance_score, min_competency_score, min_learning_progress)
VALUES
  -- Front Office
  ('Front Desk Staff', 'Front Office', false, 'Guest reception, check-in/out, and guest inquiries handling.',
   '[{"competency": "Customer Service", "requiredScore": 85}, {"competency": "Communication", "requiredScore": 80}, {"competency": "Reservation Management", "requiredScore": 80}]'::jsonb,
   '["Front Desk Operations & PMS Mastery", "Guest Conflict Resolution & Recovery"]'::jsonb, 75, 75, 70),

  ('Receptionist', 'Front Office', false, 'Welcoming guests, room assignments, and switchboard operations.',
   '[{"competency": "Customer Service", "requiredScore": 85}, {"competency": "Communication", "requiredScore": 85}, {"competency": "Hospitality SOP Compliance", "requiredScore": 80}]'::jsonb,
   '["Front Desk Operations & PMS Mastery"]'::jsonb, 75, 75, 70),

  ('Night Auditor & Reception', 'Front Office', false, 'Night audit reconciliation, reporting, and late guest reception.',
   '[{"competency": "Reservation Management", "requiredScore": 88}, {"competency": "Communication", "requiredScore": 82}, {"competency": "Hospitality SOP Compliance", "requiredScore": 85}]'::jsonb,
   '["Front Desk Operations & PMS Mastery"]'::jsonb, 80, 80, 75),

  ('Concierge', 'Front Office', false, 'Local tours, reservations, VIP guest assistance, and recommendations.',
   '[{"competency": "Customer Service", "requiredScore": 90}, {"competency": "Communication", "requiredScore": 88}, {"competency": "Upselling", "requiredScore": 75}]'::jsonb,
   '["Concierge & Guest Experience Excellence"]'::jsonb, 80, 80, 75),

  ('Head Concierge', 'Front Office', true, 'Oversees concierge operations, VIP services, and transportation desk.',
   '[{"competency": "Customer Service", "requiredScore": 92}, {"competency": "Communication", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 80}]'::jsonb,
   '["Concierge & Guest Experience Excellence", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Front Desk Supervisor', 'Front Office', true, 'Supervises front desk shift operations, guest escalations, and room inventory.',
   '[{"competency": "Customer Service", "requiredScore": 90}, {"competency": "Communication", "requiredScore": 88}, {"competency": "Reservation Management", "requiredScore": 88}, {"competency": "Conflict Resolution", "requiredScore": 82}, {"competency": "Leadership", "requiredScore": 80}]'::jsonb,
   '["Front Desk Operations & PMS Mastery", "Guest Conflict Resolution & Recovery", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Front Office Manager', 'Front Office', true, 'Overall responsibility for Front Desk, Concierge, Reservations, and Night Audit.',
   '[{"competency": "Customer Service", "requiredScore": 92}, {"competency": "Communication", "requiredScore": 90}, {"competency": "Reservation Management", "requiredScore": 90}, {"competency": "Conflict Resolution", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 88}, {"competency": "Financial Acumen", "requiredScore": 80}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills", "Guest Conflict Resolution & Recovery"]'::jsonb, 88, 88, 85),

  -- Housekeeping
  ('Housekeeping Staff', 'Housekeeping', false, 'Daily guest room cleaning, bed making, and linen changes.',
   '[{"competency": "Room Standards & Inspection", "requiredScore": 85}, {"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 85}, {"competency": "Speed & Turnover Efficiency", "requiredScore": 80}]'::jsonb,
   '["Housekeeping Standards & Room Inspection", "OSHA & Chemical Safety in Hospitality"]'::jsonb, 75, 75, 70),

  ('Senior Room Attendant', 'Housekeeping', false, 'VIP floor room preparation, mentoring junior attendants, deep cleaning.',
   '[{"competency": "Room Standards & Inspection", "requiredScore": 90}, {"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 88}, {"competency": "Speed & Turnover Efficiency", "requiredScore": 85}]'::jsonb,
   '["Housekeeping Standards & Room Inspection", "OSHA & Chemical Safety in Hospitality"]'::jsonb, 80, 80, 75),

  ('Linen & Laundry Lead', 'Housekeeping', false, 'Coordinates linen inventory, laundry machinery operations, and dry cleaning.',
   '[{"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 88}, {"competency": "Speed & Turnover Efficiency", "requiredScore": 85}, {"competency": "Lost & Found SOP", "requiredScore": 85}]'::jsonb,
   '["OSHA & Chemical Safety in Hospitality"]'::jsonb, 80, 80, 75),

  ('Floor Supervisor', 'Housekeeping', true, 'Inspects cleaned rooms, releases inventory to front desk, manages floor attendants.',
   '[{"competency": "Room Standards & Inspection", "requiredScore": 92}, {"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 90}, {"competency": "Speed & Turnover Efficiency", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 80}]'::jsonb,
   '["Housekeeping Standards & Room Inspection", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Housekeeping Supervisor', 'Housekeeping', true, 'Supervises housekeeping sections, public areas, and linen coordination.',
   '[{"competency": "Room Standards & Inspection", "requiredScore": 92}, {"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 82}]'::jsonb,
   '["Housekeeping Standards & Room Inspection", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Executive Housekeeper', 'Housekeeping', true, 'Directs housekeeping operations, asset maintenance, contractor management, and budgets.',
   '[{"competency": "Room Standards & Inspection", "requiredScore": 95}, {"competency": "Chemical & Bio-Safety Compliance", "requiredScore": 92}, {"competency": "Operational Management", "requiredScore": 85}, {"competency": "Leadership", "requiredScore": 88}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  -- Food & Beverage
  ('Waitress', 'Food & Beverage', false, 'Table service, order taking, guest greeting, and station maintenance.',
   '[{"competency": "Customer Service", "requiredScore": 85}, {"competency": "Floor Operations & Speed", "requiredScore": 85}, {"competency": "Hygiene & Health Standards", "requiredScore": 85}]'::jsonb,
   '["Food & Beverage Service Excellence", "Food Safety & ServSafe Certification Prep"]'::jsonb, 75, 75, 70),

  ('Lead Server', 'Food & Beverage', false, 'Paces dining room sections, handles VIP tables, guides line servers.',
   '[{"competency": "Customer Service", "requiredScore": 88}, {"competency": "Floor Operations & Speed", "requiredScore": 88}, {"competency": "POS & Cash Reconciliation", "requiredScore": 82}]'::jsonb,
   '["Food & Beverage Service Excellence", "POS & Cash Handling Procedures"]'::jsonb, 80, 80, 75),

  ('Banquet Server', 'Food & Beverage', false, 'Event banquet service, buffet setup, banquet hall breakdown.',
   '[{"competency": "Floor Operations & Speed", "requiredScore": 85}, {"competency": "Customer Service", "requiredScore": 82}, {"competency": "Hygiene & Health Standards", "requiredScore": 85}]'::jsonb,
   '["Food & Beverage Service Excellence"]'::jsonb, 75, 75, 70),

  ('Bartender', 'Food & Beverage', false, 'Mixology, beverage prep, bar sanitation, and alcohol compliance.',
   '[{"competency": "Customer Service", "requiredScore": 85}, {"competency": "POS & Cash Reconciliation", "requiredScore": 85}, {"competency": "Hygiene & Health Standards", "requiredScore": 85}]'::jsonb,
   '["Bar & Mixology Fundamentals", "POS & Cash Handling Procedures"]'::jsonb, 78, 78, 72),

  ('Cashier', 'Food & Beverage', false, 'Bill presentation, payment processing, register balancing, shift close.',
   '[{"competency": "POS & Cash Reconciliation", "requiredScore": 90}, {"competency": "Customer Service", "requiredScore": 82}, {"competency": "Hygiene & Health Standards", "requiredScore": 80}]'::jsonb,
   '["POS & Cash Handling Procedures"]'::jsonb, 78, 78, 72),

  ('F&B Supervisor', 'Food & Beverage', true, 'Supervises dining floor, bar service, shift briefings, and guest issues.',
   '[{"competency": "Customer Service", "requiredScore": 90}, {"competency": "Floor Operations & Speed", "requiredScore": 90}, {"competency": "POS & Cash Reconciliation", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 82}]'::jsonb,
   '["Food & Beverage Service Excellence", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Restaurant Manager', 'Food & Beverage', true, 'Directs all restaurant outlets, service quality, labor scheduling, and F&B revenues.',
   '[{"competency": "Customer Service", "requiredScore": 92}, {"competency": "Floor Operations & Speed", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 88}, {"competency": "Financial Acumen", "requiredScore": 82}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  -- Kitchen
  ('Kitchen Staff', 'Kitchen', false, 'Basic kitchen prep, dishwashing sanitation, station restocking.',
   '[{"competency": "HACCP & Kitchen Sanitation", "requiredScore": 90}, {"competency": "Food Safety", "requiredScore": 88}, {"competency": "Prep & Station Inventory", "requiredScore": 80}]'::jsonb,
   '["Culinary Arts & Kitchen Operations", "Food Safety & ServSafe Certification Prep"]'::jsonb, 75, 75, 70),

  ('Cook', 'Kitchen', false, 'Line cooking, station preparation, plate presentation, recipe execution.',
   '[{"competency": "Line Expediting & Speed", "requiredScore": 88}, {"competency": "Recipe Consistency & Flavor", "requiredScore": 88}, {"competency": "Food Safety", "requiredScore": 90}]'::jsonb,
   '["Culinary Arts & Kitchen Operations", "Food Safety & ServSafe Certification Prep"]'::jsonb, 80, 80, 75),

  ('Sous Chef', 'Kitchen', true, 'Directs kitchen stations, expedites during peak rush, oversees sanitation & food quality.',
   '[{"competency": "Line Expediting & Speed", "requiredScore": 92}, {"competency": "Recipe Consistency & Flavor", "requiredScore": 92}, {"competency": "HACCP & Kitchen Sanitation", "requiredScore": 95}, {"competency": "Leadership", "requiredScore": 82}]'::jsonb,
   '["Culinary Arts & Kitchen Operations", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Executive Chef', 'Kitchen', true, 'Oversees entire culinary division, menu development, kitchen safety, and food cost control.',
   '[{"competency": "Recipe Consistency & Flavor", "requiredScore": 95}, {"competency": "HACCP & Kitchen Sanitation", "requiredScore": 95}, {"competency": "Leadership", "requiredScore": 90}, {"competency": "Operational Management", "requiredScore": 85}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 90, 90, 85),

  -- Operations & Management
  ('Operations Manager', 'Operations', true, 'Hotel day-to-day operations, cross-department coordination, compliance, guest ratings.',
   '[{"competency": "Operational Management", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 88}, {"competency": "Financial Acumen", "requiredScore": 82}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  ('HR Administrator', 'Human Resources', true, 'Talent acquisition, employee development, HR compliance, and succession tracking.',
   '[{"competency": "Compliance", "requiredScore": 90}, {"competency": "Communication", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 85}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  ('Senior Manager', 'Executive Office', true, 'Executive decision-making, organizational strategy, P&L oversight, and executive governance.',
   '[{"competency": "Leadership", "requiredScore": 92}, {"competency": "Financial Acumen", "requiredScore": 90}, {"competency": "Operational Management", "requiredScore": 90}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 90, 90, 85)
ON CONFLICT (title) DO UPDATE SET
  department = EXCLUDED.department,
  is_critical = EXCLUDED.is_critical,
  description = EXCLUDED.description,
  required_competencies = EXCLUDED.required_competencies,
  required_learning = EXCLUDED.required_learning,
  min_performance_score = EXCLUDED.min_performance_score,
  min_competency_score = EXCLUDED.min_competency_score,
  min_learning_progress = EXCLUDED.min_learning_progress,
  updated_at = NOW();

-- Update department_id foreign keys on positions table
UPDATE positions p
SET department_id = d.id
FROM departments d
WHERE p.department = d.name AND p.department_id IS NULL;

-- Backfill initial position_history for all current employees if not present
INSERT INTO position_history (employee_id, previous_position, new_position, effective_date, reason)
SELECT e.id, 'Initial Placement', e.job_title, e.created_at::date, 'Initial Position'
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM position_history ph WHERE ph.employee_id = e.id);

-- 028_hotel_department_positions.sql
-- Add positions for Security, Engineering, Sales & Marketing, and Finance to ensure all 11 departments are fully covered.

INSERT INTO positions (title, department, is_critical, description, required_competencies, required_learning, min_performance_score, min_competency_score, min_learning_progress)
VALUES
  -- Security
  ('CCTV & Patrol Officer', 'Security', false, 'Surveillance monitoring, premise patrol, and incident reporting.',
   '[{"competency": "Patrol & Inspection", "requiredScore": 80}, {"competency": "Surveillance Systems", "requiredScore": 80}, {"competency": "Incident Response & Safety", "requiredScore": 80}]'::jsonb,
   '["Hotel Safety & Emergency Response Procedures", "Security Operations & Surveillance"]'::jsonb, 75, 75, 70),

  ('Security Supervisor', 'Security', true, 'Supervises security shifts, incident management, patrol dispatch, and safety protocols.',
   '[{"competency": "Patrol & Inspection", "requiredScore": 85}, {"competency": "Surveillance Systems", "requiredScore": 85}, {"competency": "Incident Response & Safety", "requiredScore": 85}, {"competency": "Crisis Management & Evacuation", "requiredScore": 80}, {"competency": "Leadership", "requiredScore": 80}]'::jsonb,
   '["Hotel Safety & Emergency Response Procedures", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Director of Security', 'Security', true, 'Directs security division, guest safety strategy, crisis response, and law enforcement liaison.',
   '[{"competency": "Crisis Management & Evacuation", "requiredScore": 90}, {"competency": "Incident Response & Safety", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 88}, {"competency": "Operational Management", "requiredScore": 85}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  -- Engineering
  ('HVAC & Maintenance Tech', 'Engineering', false, 'Facility maintenance, HVAC operation, and preventive repair checks.',
   '[{"competency": "HVAC & Mechanical Systems", "requiredScore": 82}, {"competency": "Preventive Maintenance", "requiredScore": 80}, {"competency": "Workplace Safety & OSHA", "requiredScore": 80}]'::jsonb,
   '["Engineering Systems & Equipment Maintenance"]'::jsonb, 75, 75, 70),

  ('Assistant Chief Engineer', 'Engineering', true, 'Supervises engineering crews, energy efficiency, and hotel mechanical systems.',
   '[{"competency": "HVAC & Mechanical Systems", "requiredScore": 88}, {"competency": "Preventive Maintenance", "requiredScore": 88}, {"competency": "Workplace Safety & OSHA", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 80}]'::jsonb,
   '["Engineering Systems & Equipment Maintenance", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Chief Engineer', 'Engineering', true, 'Directs property operations, facilities management, capital projects, and sustainability.',
   '[{"competency": "Preventive Maintenance", "requiredScore": 92}, {"competency": "HVAC & Mechanical Systems", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 88}, {"competency": "Financial Acumen", "requiredScore": 85}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 85),

  -- Sales & Marketing
  ('Events & Banquet Coordinator', 'Sales & Marketing', false, 'Client inquiries, event logistics, banquet setup coordination, and client proposals.',
   '[{"competency": "Client Relationship Management", "requiredScore": 85}, {"competency": "Event Planning & Execution", "requiredScore": 85}, {"competency": "Communication", "requiredScore": 85}]'::jsonb,
   '["Hotel Sales Strategies & Revenue Maximization"]'::jsonb, 80, 80, 75),

  ('Sales Manager', 'Sales & Marketing', true, 'Corporate account management, group sales contracts, and revenue target delivery.',
   '[{"competency": "Client Relationship Management", "requiredScore": 90}, {"competency": "Negotiation & Contracting", "requiredScore": 88}, {"competency": "Communication", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 82}]'::jsonb,
   '["Hotel Sales Strategies & Revenue Maximization", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 85, 85, 80),

  ('Director of Sales', 'Sales & Marketing', true, 'Directs commercial sales strategy, digital marketing, partnerships, and revenue performance.',
   '[{"competency": "Negotiation & Contracting", "requiredScore": 92}, {"competency": "Client Relationship Management", "requiredScore": 92}, {"competency": "Financial Acumen", "requiredScore": 88}, {"competency": "Leadership", "requiredScore": 90}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 90, 90, 85),

  -- Finance
  ('Senior General Accountant', 'Finance', false, 'General ledger reconciliation, journal entries, AP/AR auditing, and tax schedules.',
   '[{"competency": "Financial Reporting & USALI", "requiredScore": 88}, {"competency": "Account Reconciliation & Ledger", "requiredScore": 88}, {"competency": "Internal Controls & Compliance", "requiredScore": 85}]'::jsonb,
   '["Hotel Financial Accounting & Controls"]'::jsonb, 82, 82, 78),

  ('Assistant Financial Controller', 'Finance', true, 'Supervises accounting operations, daily audits, monthly financial closures, and budget variance.',
   '[{"competency": "Financial Reporting & USALI", "requiredScore": 92}, {"competency": "Account Reconciliation & Ledger", "requiredScore": 90}, {"competency": "Internal Controls & Compliance", "requiredScore": 90}, {"competency": "Leadership", "requiredScore": 82}]'::jsonb,
   '["Hotel Financial Accounting & Controls", "Hospitality Leadership & Supervisory Skills"]'::jsonb, 88, 88, 82),

  ('Financial Controller', 'Finance', true, 'Directs hotel finance, USALI compliance, fiscal risk management, owner relations, and capital planning.',
   '[{"competency": "Financial Reporting & USALI", "requiredScore": 95}, {"competency": "Internal Controls & Compliance", "requiredScore": 95}, {"competency": "Leadership", "requiredScore": 90}, {"competency": "Financial Acumen", "requiredScore": 95}]'::jsonb,
   '["Hospitality Leadership & Supervisory Skills"]'::jsonb, 92, 92, 88)
ON CONFLICT (title) DO UPDATE SET
  department = EXCLUDED.department,
  is_critical = EXCLUDED.is_critical,
  description = EXCLUDED.description,
  required_competencies = EXCLUDED.required_competencies,
  required_learning = EXCLUDED.required_learning,
  min_performance_score = EXCLUDED.min_performance_score,
  min_competency_score = EXCLUDED.min_competency_score,
  min_learning_progress = EXCLUDED.min_learning_progress,
  updated_at = NOW();
