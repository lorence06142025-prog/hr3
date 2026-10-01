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

-- Update department_id foreign keys on positions table
UPDATE positions p
SET department_id = d.id
FROM departments d
WHERE LOWER(d.name) = LOWER(p.department) AND p.department_id IS NULL;
