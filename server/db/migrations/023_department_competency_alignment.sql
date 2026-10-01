-- 023_department_competency_alignment.sql
-- Clean up competency assessments to strictly reflect department-specific roles and competencies.
-- Prevents cross-department contamination (e.g., Kitchen Operations in Front Office).

-- 1. Remove Kitchen/Culinary competencies from non-kitchen departments (Front Office, Housekeeping, HR, Executive Office)
DELETE FROM competency_assessments ca
USING employees e
WHERE ca.employee_id = e.id
  AND ca.competency IN ('Kitchen Operations', 'Food Safety')
  AND e.department IN ('Front Office', 'Housekeeping', 'Human Resources', 'Executive Office');

-- 2. Remove Front Desk / Reservation Management from non-front-office departments (Kitchen, Housekeeping)
DELETE FROM competency_assessments ca
USING employees e
WHERE ca.employee_id = e.id
  AND ca.competency IN ('Reservation Management', 'Front Desk Operations')
  AND e.department IN ('Kitchen', 'Housekeeping');

-- 3. Remove Housekeeping-specific competencies from Kitchen, Front Office, F&B
DELETE FROM competency_assessments ca
USING employees e
WHERE ca.employee_id = e.id
  AND ca.competency IN ('Housekeeping Standards', 'Housekeeping Operations')
  AND e.department IN ('Kitchen', 'Front Office', 'Food & Beverage');
