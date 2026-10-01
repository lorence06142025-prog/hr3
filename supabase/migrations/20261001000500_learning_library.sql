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
  video_url TEXT,
  pdf_url TEXT,
  lesson_content TEXT,
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
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','studying','completed','need_help')),
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

-- Logistics learning catalog. Each resource is tagged to the competency gaps
-- it is intended to address so recommendations are useful immediately after reset.
WITH modules(title, description, category, duration_hours, objectives, competencies) AS (
  VALUES
    ('Defensive Driving & Hours-of-Service Compliance', 'Practical defensive driving, fatigue awareness, journey planning, and driver-hours compliance.', 'Fleet Safety', 6, 'Apply defensive driving; plan safe journeys; follow hours-of-service requirements.', ARRAY['Defensive Driving','Regulatory Compliance']::TEXT[]),
    ('Pre-Trip and Post-Trip Vehicle Inspection', 'Standard vehicle walkarounds, defect recognition, inspection checklists, and reporting.', 'Fleet Safety', 3, 'Complete inspections; identify defects; document and escalate vehicle issues.', ARRAY['Vehicle Inspection & Preventive Checks']::TEXT[]),
    ('Cargo Securement and Load Restraint', 'Safe freight loading, weight distribution, restraint selection, and load checks.', 'Fleet Operations', 4, 'Select securement methods; protect cargo; verify load stability before departure.', ARRAY['Cargo Securement']::TEXT[]),
    ('Driver Fatigue and Journey Risk Management', 'Fatigue indicators, route risk assessment, weather planning, and escalation.', 'Fleet Safety', 3, 'Identify journey hazards; manage fatigue; apply risk controls and escalation steps.', ARRAY['Risk Assessment','Defensive Driving']::TEXT[]),
    ('Fuel-Efficient Driving and Vehicle Care', 'Driving behaviors, idle reduction, fuel tracking, and daily vehicle care.', 'Fleet Operations', 3, 'Reduce avoidable fuel use; report vehicle issues; apply economical driving practices.', ARRAY['Fuel-Efficient Operations']::TEXT[]),
    ('TMS and GPS Dispatch Fundamentals', 'Core transport management system workflows, GPS monitoring, status codes, and dispatch handoffs.', 'Dispatch & Routing', 4, 'Use TMS/GPS tools; keep shipment milestones current; communicate dispatch changes.', ARRAY['TMS & GPS Proficiency','Dispatch Communication']::TEXT[]),
    ('Route Planning and Delivery Window Optimization', 'Route sequencing using capacity, delivery windows, traffic, and service constraints.', 'Dispatch & Routing', 5, 'Build efficient routes; balance capacity and delivery windows; review route outcomes.', ARRAY['Route Planning & Optimization']::TEXT[]),
    ('Load Scheduling and Capacity Planning', 'Load building, vehicle capacity, cutoff coordination, and schedule adjustments.', 'Dispatch & Routing', 4, 'Schedule loads; match freight to capacity; coordinate dispatch priorities.', ARRAY['Load Scheduling']::TEXT[]),
    ('Dispatch Exceptions and Delay Recovery', 'Late shipment response, breakdown coordination, customer updates, and exception closure.', 'Dispatch & Routing', 3, 'Classify exceptions; choose recovery actions; record outcomes and notify stakeholders.', ARRAY['Exception Management']::TEXT[]),
    ('Fleet Maintenance Planning and Downtime Reduction', 'Preventive service schedules, defect prioritization, maintenance records, and vehicle availability.', 'Fleet Maintenance', 5, 'Plan preventive maintenance; prioritize defects; reduce avoidable vehicle downtime.', ARRAY['Vehicle Inspection & Preventive Checks']::TEXT[]),
    ('Warehouse Safety and Incident Reporting', 'Safe warehouse movement, hazard controls, near-miss reporting, and corrective actions.', 'Warehouse Operations', 3, 'Recognize hazards; use safe work practices; report incidents and near misses.', ARRAY['Warehouse Safety','Incident Reporting']::TEXT[]),
    ('Forklift Operator Safety and Load Stability', 'Powered industrial truck inspections, safe operating zones, stacking, and stable loads.', 'Warehouse Operations', 4, 'Inspect equipment; move loads safely; maintain stability and pedestrian separation.', ARRAY['Forklift Operation & Safety']::TEXT[]),
    ('Freight Receiving, Scanning and Inventory Accuracy', 'Inbound freight verification, barcode scanning, discrepancy handling, and inventory updates.', 'Warehouse Operations', 3, 'Verify receipts; scan freight accurately; record and resolve quantity discrepancies.', ARRAY['Inventory Accuracy','WMS Proficiency']::TEXT[]),
    ('Order Picking, Packing and Shipment Staging', 'Pick-list accuracy, packaging standards, label checks, and outbound staging.', 'Warehouse Operations', 3, 'Pick correct items; protect shipments; stage freight for the correct route and cutoff.', ARRAY['Picking & Packing']::TEXT[]),
    ('WMS Cycle Counting and Inventory Reconciliation', 'Cycle-count methods, location accuracy, variance research, and inventory adjustment controls.', 'Warehouse Operations', 4, 'Perform cycle counts; investigate variances; maintain traceable inventory records.', ARRAY['WMS Proficiency','Inventory Accuracy']::TEXT[]),
    ('Freight Customer Service and Shipment Visibility', 'Shipment status research, clear customer updates, service expectations, and follow-through.', 'Customer Service', 3, 'Trace shipments; communicate verified updates; set realistic next steps.', ARRAY['Shipment Tracking','Customer Communication']::TEXT[]),
    ('Proof of Delivery, Returns and Claims Evidence', 'POD capture, delivery exception records, returns documentation, and evidence retention.', 'Customer Service', 3, 'Capture accurate POD; document exceptions; preserve records for claims review.', ARRAY['Proof-of-Delivery Accuracy','Claims Resolution']::TEXT[]),
    ('Freight Claims Handling and Damage Prevention', 'Damage prevention, claim intake, evidence gathering, and resolution workflows.', 'Customer Service', 4, 'Prevent cargo damage; assemble claim evidence; coordinate timely resolution.', ARRAY['Claims Resolution','Cargo Securement']::TEXT[]),
    ('Incident Investigation and Corrective Action', 'Incident timelines, root-cause analysis, evidence handling, and preventive actions.', 'Safety & Compliance', 4, 'Document incidents; identify contributing factors; assign and track corrective actions.', ARRAY['Incident Reporting','Risk Assessment']::TEXT[]),
    ('Transportation Regulations and Document Control', 'Required transport records, retention practices, operating rules, and compliance checks.', 'Safety & Compliance', 4, 'Identify required records; maintain accurate documents; escalate compliance risks.', ARRAY['Regulatory Compliance','Documentation Accuracy']::TEXT[]),
    ('Driver Coaching and Safety Leadership', 'Structured coaching, observation feedback, safe-driving plans, and follow-up.', 'Safety & Compliance', 5, 'Coach safe behaviors; set measurable actions; review outcomes with drivers.', ARRAY['Driver Coaching','Leadership']::TEXT[]),
    ('Freight Billing, Rating and Invoice Auditing', 'Rate verification, accessorial review, shipment documentation, and billing exceptions.', 'Finance & Administration', 4, 'Audit freight charges; verify supporting records; resolve invoice variances.', ARRAY['Freight Billing & Audit']::TEXT[]),
    ('Frontline Leadership for Logistics Supervisors', 'Shift huddles, staffing and capacity decisions, coaching, and escalation management.', 'Leadership & People', 6, 'Lead daily operations; coach teams; use performance data to prioritize improvements.', ARRAY['Leadership','Operational Management']::TEXT[]),
    ('Employee Onboarding and Driver Qualification', 'Role onboarding, qualification records, policy acknowledgement, and compliance checkpoints.', 'Human Resources', 4, 'Complete onboarding steps; maintain qualification records; identify missing requirements.', ARRAY['Recruitment & Selection','Labor Compliance']::TEXT[])
), inserted AS (
  INSERT INTO learning_resources (
    title, description, category, provider, provider_type, duration_hours,
    objectives, created_by
  )
  SELECT
    m.title,
    m.description,
    m.category,
    'Priority Logistics Learning',
    'internal',
    m.duration_hours,
    m.objectives,
    (SELECT id FROM users WHERE role = 'hr' ORDER BY created_at LIMIT 1)
  FROM modules m
  WHERE NOT EXISTS (SELECT 1 FROM learning_resources r WHERE r.title = m.title)
  RETURNING id, title
)
INSERT INTO learning_resource_competencies (resource_id, competency)
SELECT r.id, competency
FROM modules m
JOIN learning_resources r ON r.title = m.title
CROSS JOIN LATERAL unnest(m.competencies) AS tags(competency)
ON CONFLICT DO NOTHING;
