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
