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
-- Seed freight and logistics succession positions.
-- ============================================================
-- Freight and logistics position catalog: 39 roles across the eight seeded departments.
INSERT INTO positions (
  title, department, is_critical, description, required_competencies,
  required_learning, min_performance_score, min_competency_score, min_learning_progress
)
VALUES
  ('General Manager', 'Executive Office', true, 'Leads company strategy, service performance, and financial results.', '[{"competency":"Operational Management","requiredScore":95},{"competency":"Leadership","requiredScore":95},{"competency":"Financial Acumen","requiredScore":90}]'::jsonb, '["Freight Operations Leadership","Logistics Finance & Performance"]'::jsonb, 90, 90, 85),
  ('Chief Operating Officer', 'Executive Office', true, 'Owns transportation, dispatch, warehouse, and service operations.', '[{"competency":"Operational Management","requiredScore":95},{"competency":"Strategic Planning","requiredScore":92},{"competency":"Regulatory Compliance","requiredScore":90}]'::jsonb, '["Freight Operations Leadership","Supply Chain Risk Management"]'::jsonb, 90, 90, 85),
  ('Operations Director', 'Executive Office', true, 'Coordinates operating departments, service levels, capacity, and improvement.', '[{"competency":"Operational Management","requiredScore":92},{"competency":"Data-Driven Decision Making","requiredScore":88},{"competency":"Leadership","requiredScore":90}]'::jsonb, '["Freight Network Planning","Operational Analytics"]'::jsonb, 88, 88, 85),
  ('HR Manager', 'Human Resources', true, 'Leads workforce planning, employee relations, recruiting, and labor compliance.', '[{"competency":"Employee Relations","requiredScore":90},{"competency":"Recruitment & Selection","requiredScore":90},{"competency":"Labor Compliance","requiredScore":92}]'::jsonb, '["HR Operations","Workforce Planning"]'::jsonb, 85, 85, 80),
  ('HR Generalist', 'Human Resources', false, 'Supports onboarding, employee records, benefits, and employee inquiries.', '[{"competency":"Employee Relations","requiredScore":85},{"competency":"Communication","requiredScore":85},{"competency":"Documentation Accuracy","requiredScore":88}]'::jsonb, '["HR Operations","Employee Onboarding"]'::jsonb, 78, 78, 75),
  ('Recruitment Specialist', 'Human Resources', false, 'Recruits drivers, dispatchers, warehouse staff, and support employees.', '[{"competency":"Recruitment & Selection","requiredScore":90},{"competency":"Communication","requiredScore":85},{"competency":"Labor Compliance","requiredScore":82}]'::jsonb, '["Driver Qualification & Hiring","Structured Interviewing"]'::jsonb, 80, 80, 75),
  ('Fleet Operations Manager', 'Fleet & Transportation', true, 'Manages fleet utilization, driver capacity, vehicle readiness, and transport costs.', '[{"competency":"Vehicle Inspection & Preventive Checks","requiredScore":92},{"competency":"Operational Management","requiredScore":90},{"competency":"Fuel-Efficient Operations","requiredScore":88}]'::jsonb, '["Fleet Utilization","Freight Operations Leadership"]'::jsonb, 88, 88, 85),
  ('Transportation Supervisor', 'Fleet & Transportation', true, 'Supervises drivers, vehicle readiness, and delivery execution.', '[{"competency":"Defensive Driving","requiredScore":90},{"competency":"Route Compliance","requiredScore":90},{"competency":"Driver Coaching","requiredScore":85}]'::jsonb, '["Driver Safety","Transportation Supervision"]'::jsonb, 85, 85, 80),
  ('Fleet Coordinator', 'Fleet & Transportation', false, 'Coordinates vehicle assignments, maintenance schedules, fuel, and fleet records.', '[{"competency":"Vehicle Inspection & Preventive Checks","requiredScore":88},{"competency":"Documentation Accuracy","requiredScore":85},{"competency":"Communication","requiredScore":82}]'::jsonb, '["Fleet Maintenance Planning","Fleet Systems"]'::jsonb, 78, 78, 75),
  ('Heavy Vehicle Driver', 'Fleet & Transportation', false, 'Operates heavy vehicles safely and completes assigned freight routes.', '[{"competency":"Defensive Driving","requiredScore":92},{"competency":"Vehicle Inspection & Preventive Checks","requiredScore":90},{"competency":"Cargo Securement","requiredScore":90}]'::jsonb, '["Defensive Driving","Cargo Securement","Hours-of-Service Compliance"]'::jsonb, 80, 82, 75),
  ('Delivery Driver', 'Fleet & Transportation', false, 'Completes deliveries, verifies shipments, and captures proof of delivery.', '[{"competency":"Defensive Driving","requiredScore":90},{"competency":"Route Compliance","requiredScore":88},{"competency":"Proof-of-Delivery Accuracy","requiredScore":90}]'::jsonb, '["Delivery Procedures","Customer Communication"]'::jsonb, 78, 80, 75),
  ('Driver', 'Fleet & Transportation', false, 'Transports freight safely, on schedule, and in accordance with regulations.', '[{"competency":"Defensive Driving","requiredScore":90},{"competency":"Cargo Securement","requiredScore":88},{"competency":"Regulatory Compliance","requiredScore":88}]'::jsonb, '["Driver Safety","Cargo Securement","Incident Reporting"]'::jsonb, 78, 80, 75),
  ('Vehicle Maintenance Technician', 'Fleet & Transportation', false, 'Inspects and repairs fleet vehicles to maintain safe operating condition.', '[{"competency":"Vehicle Inspection & Preventive Checks","requiredScore":92},{"competency":"Risk Assessment","requiredScore":85},{"competency":"Documentation Accuracy","requiredScore":82}]'::jsonb, '["Preventive Fleet Maintenance","Workshop Safety"]'::jsonb, 80, 82, 75),
  ('Vehicle Inspector', 'Fleet & Transportation', false, 'Performs pre-trip and scheduled inspections and records vehicle defects.', '[{"competency":"Vehicle Inspection & Preventive Checks","requiredScore":92},{"competency":"Incident Reporting","requiredScore":85},{"competency":"Regulatory Compliance","requiredScore":88}]'::jsonb, '["Pre-Trip Inspection","Defect Reporting"]'::jsonb, 80, 82, 75),
  ('Dispatch Manager', 'Dispatch & Routing', true, 'Leads dispatch planning, load assignments, route performance, and exceptions.', '[{"competency":"Route Planning & Optimization","requiredScore":92},{"competency":"Load Scheduling","requiredScore":90},{"competency":"Exception Management","requiredScore":90}]'::jsonb, '["Dispatch Operations","Transportation Management Systems"]'::jsonb, 88, 88, 85),
  ('Dispatch Supervisor', 'Dispatch & Routing', true, 'Coordinates dispatcher shifts, route execution, updates, and escalations.', '[{"competency":"Dispatch Communication","requiredScore":92},{"competency":"TMS & GPS Proficiency","requiredScore":90},{"competency":"Exception Management","requiredScore":88}]'::jsonb, '["Dispatch Supervision","Shipment Exception Handling"]'::jsonb, 85, 85, 80),
  ('Dispatcher', 'Dispatch & Routing', false, 'Assigns loads and drivers, monitors routes, and communicates service changes.', '[{"competency":"Load Scheduling","requiredScore":88},{"competency":"Dispatch Communication","requiredScore":90},{"competency":"TMS & GPS Proficiency","requiredScore":88}]'::jsonb, '["Dispatch Operations","TMS & GPS Basics"]'::jsonb, 78, 80, 75),
  ('Senior Dispatcher', 'Dispatch & Routing', false, 'Handles complex loads and supports dispatchers with route exceptions.', '[{"competency":"Route Planning & Optimization","requiredScore":90},{"competency":"Exception Management","requiredScore":92},{"competency":"Dispatch Communication","requiredScore":90}]'::jsonb, '["Advanced Dispatch","Service Recovery"]'::jsonb, 82, 85, 78),
  ('Route Planner', 'Dispatch & Routing', false, 'Builds efficient routes using delivery windows, capacity, and service constraints.', '[{"competency":"Route Planning & Optimization","requiredScore":92},{"competency":"TMS & GPS Proficiency","requiredScore":88},{"competency":"Data-Driven Decision Making","requiredScore":82}]'::jsonb, '["Route Optimization","Network Planning"]'::jsonb, 80, 85, 78),
  ('Load Planner', 'Dispatch & Routing', false, 'Plans loads to balance vehicle capacity, delivery needs, and cost.', '[{"competency":"Load Scheduling","requiredScore":92},{"competency":"Cargo Securement","requiredScore":85},{"competency":"Documentation Accuracy","requiredScore":85}]'::jsonb, '["Load Planning","Freight Classification"]'::jsonb, 80, 82, 75),
  ('Warehouse Manager', 'Warehouse & Inventory', true, 'Leads warehouse throughput, inventory control, staffing, and safety.', '[{"competency":"Inventory Accuracy","requiredScore":95},{"competency":"Warehouse Safety","requiredScore":92},{"competency":"Operational Management","requiredScore":88}]'::jsonb, '["Warehouse Operations Leadership","WMS Administration"]'::jsonb, 88, 88, 85),
  ('Warehouse Supervisor', 'Warehouse & Inventory', true, 'Supervises receiving, put-away, picking, packing, loading, and shift safety.', '[{"competency":"Picking & Packing","requiredScore":90},{"competency":"Forklift Operation & Safety","requiredScore":92},{"competency":"Warehouse Safety","requiredScore":92}]'::jsonb, '["Warehouse Supervision","Safe Material Handling"]'::jsonb, 85, 85, 80),
  ('Warehouse Associate', 'Warehouse & Inventory', false, 'Receives, stores, picks, and stages freight accurately and safely.', '[{"competency":"Picking & Packing","requiredScore":85},{"competency":"Inventory Accuracy","requiredScore":85},{"competency":"Warehouse Safety","requiredScore":88}]'::jsonb, '["Warehouse Safety","Freight Handling"]'::jsonb, 75, 78, 72),
  ('Forklift Operator', 'Warehouse & Inventory', false, 'Moves and stages freight using powered industrial trucks safely.', '[{"competency":"Forklift Operation & Safety","requiredScore":95},{"competency":"Warehouse Safety","requiredScore":90},{"competency":"Inventory Accuracy","requiredScore":82}]'::jsonb, '["Powered Industrial Truck Safety","Load Stability"]'::jsonb, 78, 82, 75),
  ('Inventory Control Clerk', 'Warehouse & Inventory', false, 'Maintains inventory records, reconciles counts, and investigates variances.', '[{"competency":"Inventory Accuracy","requiredScore":95},{"competency":"WMS Proficiency","requiredScore":88},{"competency":"Documentation Accuracy","requiredScore":90}]'::jsonb, '["Cycle Counting","Warehouse Management Systems"]'::jsonb, 80, 85, 78),
  ('Picking & Packing Associate', 'Warehouse & Inventory', false, 'Picks orders and packs shipments to accuracy and cargo-protection standards.', '[{"competency":"Picking & Packing","requiredScore":92},{"competency":"Cargo Securement","requiredScore":82},{"competency":"Inventory Accuracy","requiredScore":85}]'::jsonb, '["Order Picking","Packaging & Freight Protection"]'::jsonb, 75, 80, 72),
  ('Warehouse Lead', 'Warehouse & Inventory', false, 'Coordinates floor assignments, shipping cutoffs, and shift handoffs.', '[{"competency":"Picking & Packing","requiredScore":90},{"competency":"Warehouse Safety","requiredScore":90},{"competency":"Communication","requiredScore":85}]'::jsonb, '["Warehouse Shift Leadership","Safe Material Handling"]'::jsonb, 82, 84, 78),
  ('Customer Service Manager', 'Customer Service', true, 'Leads shipment support, customer communication, claims, and service quality.', '[{"competency":"Shipment Tracking","requiredScore":92},{"competency":"Claims Resolution","requiredScore":90},{"competency":"Service Recovery","requiredScore":90}]'::jsonb, '["Freight Customer Service","Claims Management"]'::jsonb, 88, 88, 85),
  ('Customer Service Representative', 'Customer Service', false, 'Answers shipment inquiries and provides timely, accurate updates.', '[{"competency":"Shipment Tracking","requiredScore":90},{"competency":"Customer Communication","requiredScore":90},{"competency":"Proof-of-Delivery Accuracy","requiredScore":85}]'::jsonb, '["Freight Customer Service","Shipment Tracking Systems"]'::jsonb, 78, 82, 75),
  ('Shipment Tracking Specialist', 'Customer Service', false, 'Monitors shipment milestones and communicates delays or exceptions.', '[{"competency":"Shipment Tracking","requiredScore":92},{"competency":"TMS & GPS Proficiency","requiredScore":88},{"competency":"Customer Communication","requiredScore":88}]'::jsonb, '["Shipment Visibility","Exception Communication"]'::jsonb, 80, 84, 78),
  ('Claims Coordinator', 'Customer Service', false, 'Coordinates freight claims, evidence collection, follow-up, and resolution.', '[{"competency":"Claims Resolution","requiredScore":92},{"competency":"Documentation Accuracy","requiredScore":92},{"competency":"Customer Communication","requiredScore":85}]'::jsonb, '["Freight Claims Handling","Evidence & Document Control"]'::jsonb, 80, 85, 78),
  ('Safety & Compliance Manager', 'Safety & Compliance', true, 'Leads transportation safety, compliance, incident review, and corrective action.', '[{"competency":"Regulatory Compliance","requiredScore":95},{"competency":"Risk Assessment","requiredScore":92},{"competency":"Incident Reporting","requiredScore":92}]'::jsonb, '["Transportation Safety Leadership","Regulatory Compliance"]'::jsonb, 88, 90, 85),
  ('Safety Coordinator', 'Safety & Compliance', false, 'Maintains safety records, supports inspections, and tracks corrective actions.', '[{"competency":"Incident Reporting","requiredScore":90},{"competency":"Risk Assessment","requiredScore":88},{"competency":"Regulatory Compliance","requiredScore":88}]'::jsonb, '["Incident Reporting","Workplace Safety"]'::jsonb, 80, 84, 78),
  ('Compliance Specialist', 'Safety & Compliance', false, 'Maintains operating records and monitors regulatory obligations.', '[{"competency":"Regulatory Compliance","requiredScore":95},{"competency":"Documentation Accuracy","requiredScore":90},{"competency":"Risk Assessment","requiredScore":85}]'::jsonb, '["Freight Regulations","Document Retention"]'::jsonb, 82, 88, 80),
  ('Driver Trainer', 'Safety & Compliance', false, 'Coaches drivers on safe driving, inspections, and operating procedures.', '[{"competency":"Driver Coaching","requiredScore":92},{"competency":"Defensive Driving","requiredScore":95},{"competency":"Emergency Response","requiredScore":85}]'::jsonb, '["Defensive Driving Instruction","Driver Qualification"]'::jsonb, 82, 88, 80),
  ('Incident Investigator', 'Safety & Compliance', false, 'Investigates incidents, identifies causes, and recommends preventive actions.', '[{"competency":"Incident Reporting","requiredScore":95},{"competency":"Risk Assessment","requiredScore":92},{"competency":"Regulatory Compliance","requiredScore":88}]'::jsonb, '["Incident Investigation","Root Cause Analysis"]'::jsonb, 82, 88, 80),
  ('Finance Manager', 'Finance & Administration', true, 'Leads freight billing, accounting controls, payroll, and financial reporting.', '[{"competency":"Freight Billing & Audit","requiredScore":95},{"competency":"Accounts Reconciliation","requiredScore":92},{"competency":"Internal Controls","requiredScore":92}]'::jsonb, '["Logistics Finance","Freight Revenue Auditing"]'::jsonb, 88, 90, 85),
  ('Freight Billing Specialist', 'Finance & Administration', false, 'Audits shipment charges and prepares accurate freight invoices.', '[{"competency":"Freight Billing & Audit","requiredScore":92},{"competency":"Documentation Accuracy","requiredScore":90},{"competency":"Accounts Reconciliation","requiredScore":85}]'::jsonb, '["Freight Rating & Invoicing","Billing Exception Handling"]'::jsonb, 80, 85, 78),
  ('Accounts Payable Clerk', 'Finance & Administration', false, 'Processes vendor invoices and maintains accurate payment records.', '[{"competency":"Accounts Reconciliation","requiredScore":90},{"competency":"Internal Controls","requiredScore":88},{"competency":"Documentation Accuracy","requiredScore":90}]'::jsonb, '["Accounts Payable","Financial Document Control"]'::jsonb, 78, 84, 75)
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

UPDATE positions p
SET department_id = d.id
FROM departments d
WHERE p.department = d.name AND p.department_id IS DISTINCT FROM d.id;

INSERT INTO position_history (employee_id, previous_position, new_position, effective_date, reason)
SELECT e.id, 'Initial Placement', e.job_title, e.created_at::date, 'Initial Position'
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM position_history ph WHERE ph.employee_id = e.id);
