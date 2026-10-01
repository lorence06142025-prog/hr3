-- 026_role_based_competency_reseed.sql
-- Reseed baseline competency assessments by department and role so employees have role-specific competencies and gaps.

-- Delete generic baseline assessments to clean up legacy cross-department contamination
DELETE FROM competency_assessments
WHERE source = 'baseline';

-- 1. Front Office
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Customer Service', 90, -8),
    ('Communication', 88, -6),
    ('Reservation Management', 88, -10),
    ('Conflict Resolution', 80, -5),
    ('Hospitality SOP Compliance', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Front Office'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 2. Kitchen
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Line Expediting & Speed', 90, -8),
    ('Recipe Consistency & Flavor', 90, -6),
    ('HACCP & Kitchen Sanitation', 95, -12),
    ('Food Safety', 90, -5),
    ('Prep & Station Inventory', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Kitchen'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 3. Food & Beverage
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Floor Operations & Speed', 90, -8),
    ('Customer Service', 90, -7),
    ('POS & Cash Reconciliation', 85, -5),
    ('Hygiene & Health Standards', 88, -9),
    ('Team Collaboration', 85, 2)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Food & Beverage'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 4. Housekeeping
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Room Standards & Inspection', 95, -10),
    ('Chemical & Bio-Safety Compliance', 90, -6),
    ('Turnaround Time Optimization', 85, -8),
    ('Linen & Inventory Management', 85, 2),
    ('Hospitality SOP Compliance', 85, -4)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Housekeeping'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 5. Human Resources
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Employee Relations', 88, -7),
    ('Recruitment', 88, -8),
    ('Compliance', 88, -5),
    ('Communication', 80, 2),
    ('Leadership', 80, -4)
) AS c(comp, req, offset_pct)
WHERE e.department = 'Human Resources'
ON CONFLICT (employee_id, competency) DO NOTHING;

-- 6. Other departments (Executive Office, General, etc.)
INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
SELECT e.id, c.comp, GREATEST(35, LEAST(100, round(COALESCE(e.competency_score, 75)::numeric + c.offset_pct)::int)), c.req, 'baseline'
FROM employees e
CROSS JOIN (
  VALUES
    ('Operational Management', 95, -8),
    ('Leadership', 95, -6),
    ('Financial Acumen', 88, -7),
    ('Customer Service', 88, 2),
    ('Communication', 88, -4)
) AS c(comp, req, offset_pct)
WHERE e.department NOT IN ('Front Office', 'Kitchen', 'Food & Beverage', 'Housekeeping', 'Human Resources')
ON CONFLICT (employee_id, competency) DO NOTHING;
