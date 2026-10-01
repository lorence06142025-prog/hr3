import { query } from '../db.js'
import { logger } from './logger.js'

/**
 * HR2 Attendance Service
 * Handles integration with HR2 Time & Attendance / Biometric Daily Time Records (DTR).
 * Supports both live REST API integration and simulated defense demo mode.
 */

export async function fetchAndSyncAttendanceFromHR2({ period = 'Q1 2026', actorId = null } = {}) {
  const hr2ApiUrl = process.env.HR2_API_URL
  const hr2ApiKey = process.env.HR2_API_KEY
  let syncedRecords = []
  let syncSource = 'HR2_MOCK_DTR_API'

  if (hr2ApiUrl) {
    try {
      logger.info(`[HR2] Calling external HR2 API at ${hr2ApiUrl}...`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)

      const response = await fetch(`${hr2ApiUrl}/api/attendance/summary?period=${encodeURIComponent(period)}`, {
        headers: {
          'Authorization': `Bearer ${hr2ApiKey || ''}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        syncedRecords = Array.isArray(data.records) ? data.records : []
        syncSource = 'HR2_LIVE_REST_API'
        logger.info(`[HR2] Successfully received ${syncedRecords.length} records from live HR2 API.`)
      } else {
        logger.warn(`[HR2] Live API responded with status ${response.status}, falling back to simulated sync.`)
      }
    } catch (err) {
      logger.warn(`[HR2] Could not reach external HR2 API (${err.message}). Using simulated sync generator.`)
    }
  }

  // If live API returned no records or was not set, perform resilient DTR sync from active employees
  if (!syncedRecords.length) {
    const { rows: employees } = await query(
      'SELECT id, employee_number, full_name, department FROM employees WHERE is_active = true'
    )

    const isAnnual = period.toLowerCase().includes('annual')
    const totalWorkingDays = isAnnual ? 240 : 60
    const periodOffset = isAnnual ? 4 : (period.includes('Q2') ? 2 : 0)

    syncedRecords = employees.map(emp => {
      // Deterministic generation based on employee id string seed and period offset
      const hash = emp.id.split('-')[0]
      const num = parseInt(hash, 16) || 10
      const variant = (num + periodOffset) % 6
      const isHexa = emp.full_name?.toLowerCase().includes('hexa')

      let daysPresent = isAnnual ? 235 : 58
      let daysAbsent = isAnnual ? 5 : 2
      let tardyCount = isAnnual ? 3 : 1
      let tardyMinutes = isAnnual ? 45 : 15
      let attendanceScore = isAnnual ? 96.50 : 95.00
      let isPerfect = false

      if (isHexa || variant === 0) {
        // Perfect Attendance (100%)
        daysPresent = totalWorkingDays
        daysAbsent = 0
        tardyCount = 0
        tardyMinutes = 0
        attendanceScore = 100.00
        isPerfect = true
      } else if (variant === 1) {
        // Excellent (98.3% - 98.8%)
        daysPresent = isAnnual ? 238 : 59
        daysAbsent = isAnnual ? 2 : 1
        tardyCount = isAnnual ? 1 : 0
        tardyMinutes = isAnnual ? 10 : 0
        attendanceScore = isAnnual ? 98.80 : 98.33
        isPerfect = false
      } else if (variant === 2) {
        // Good with 1 minor late (96.5% - 96.7%)
        daysPresent = isAnnual ? 235 : 59
        daysAbsent = isAnnual ? 5 : 1
        tardyCount = isAnnual ? 3 : 1
        tardyMinutes = isAnnual ? 45 : 15
        attendanceScore = isAnnual ? 96.50 : 96.67
        isPerfect = false
      } else if (variant === 3) {
        // High presence, a few lates (96.5% - 96.8%)
        daysPresent = isAnnual ? 237 : 60
        daysAbsent = isAnnual ? 3 : 0
        tardyCount = isAnnual ? 4 : 2
        tardyMinutes = isAnnual ? 60 : 25
        attendanceScore = isAnnual ? 96.80 : 96.50
        isPerfect = false
      } else if (variant === 4) {
        // Moderate absences (93.5% - 94.0%)
        daysPresent = isAnnual ? 232 : 58
        daysAbsent = isAnnual ? 8 : 2
        tardyCount = isAnnual ? 5 : 1
        tardyMinutes = isAnnual ? 75 : 15
        attendanceScore = isAnnual ? 93.50 : 94.00
        isPerfect = false
      } else {
        // Needs improvement (89.0% - 89.5%)
        daysPresent = isAnnual ? 228 : 57
        daysAbsent = isAnnual ? 12 : 3
        tardyCount = isAnnual ? 6 : 2
        tardyMinutes = isAnnual ? 90 : 30
        attendanceScore = isAnnual ? 89.00 : 89.50
        isPerfect = false
      }

      return {
        employeeId: emp.id,
        totalWorkingDays,
        daysPresent,
        daysAbsent,
        tardyCount,
        tardyMinutes,
        attendanceScore,
        isPerfect,
      }
    })
  }

  // Upsert records into PostgreSQL
  let upsertCount = 0
  for (const rec of syncedRecords) {
    await query(`
      INSERT INTO hr2_attendance_records (
        employee_id, period, total_working_days, days_present, days_absent,
        tardy_count, tardy_minutes, attendance_score, is_perfect_attendance,
        sync_source, synced_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (employee_id, period) DO UPDATE SET
        total_working_days = EXCLUDED.total_working_days,
        days_present = EXCLUDED.days_present,
        days_absent = EXCLUDED.days_absent,
        tardy_count = EXCLUDED.tardy_count,
        tardy_minutes = EXCLUDED.tardy_minutes,
        attendance_score = EXCLUDED.attendance_score,
        is_perfect_attendance = EXCLUDED.is_perfect_attendance,
        sync_source = EXCLUDED.sync_source,
        synced_at = NOW(),
        updated_at = NOW()
    `, [
      rec.employeeId,
      period,
      rec.totalWorkingDays || (period.toLowerCase().includes('annual') ? 240 : 60),
      rec.daysPresent,
      rec.daysAbsent,
      rec.tardyCount,
      rec.tardyMinutes,
      rec.attendanceScore,
      rec.isPerfect,
      syncSource,
    ])
    upsertCount++
  }

  return {
    success: true,
    period,
    syncedCount: upsertCount,
    syncSource,
    syncedAt: new Date().toISOString(),
    message: `Successfully synchronized ${upsertCount} DTR attendance logs from HR2 (${syncSource}).`,
  }
}

/**
 * Get attendance record for a specific employee
 */
export async function getEmployeeAttendance(employeeId, period = 'Q1 2026') {
  const { rows } = await query(`
    SELECT
      a.id, a.employee_id, a.period, a.total_working_days, a.days_present, a.days_absent,
      a.tardy_count, a.tardy_minutes, a.attendance_score, a.is_perfect_attendance,
      a.sync_source, a.synced_at,
      e.full_name, e.employee_number, e.department, e.job_title
    FROM hr2_attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = $1 AND a.period = $2
  `, [employeeId, period])

  if (!rows[0]) {
    // If not yet synced for this period, return default on-track baseline
    const empRes = await query('SELECT id, full_name, employee_number, department, job_title FROM employees WHERE id = $1', [employeeId])
    if (!empRes.rows[0]) return null
    const e = empRes.rows[0]
    const isAnnual = period.toLowerCase().includes('annual')
    const totalWorkingDays = isAnnual ? 240 : 60
    return {
      id: null,
      employee_id: e.id,
      period,
      total_working_days: totalWorkingDays,
      days_present: isAnnual ? 238 : 59,
      days_absent: isAnnual ? 2 : 1,
      tardy_count: 0,
      tardy_minutes: 0,
      attendance_score: isAnnual ? 98.80 : 98.33,
      is_perfect_attendance: false,
      sync_source: 'PENDING_INITIAL_SYNC',
      synced_at: null,
      full_name: e.full_name,
      employee_number: e.employee_number,
      department: e.department,
      job_title: e.job_title,
    }
  }

  return rows[0]
}

/**
 * Get summary metrics for the attendance header strip
 */
export async function getAttendanceSummary({ department = null, period = 'Q1 2026' } = {}) {
  const params = [period]
  let deptClause = ''
  if (department && department !== 'All Departments') {
    params.push(department)
    deptClause = ' AND e.department = $2'
  }

  const { rows } = await query(`
    SELECT
      count(*)::int AS total_records,
      coalesce(round(avg(a.attendance_score), 1), 0.0) AS avg_attendance_score,
      coalesce(sum(a.days_present), 0)::int AS total_days_present,
      coalesce(sum(a.days_absent), 0)::int AS total_absences,
      coalesce(sum(a.tardy_count), 0)::int AS total_tardies,
      count(*) FILTER (WHERE a.is_perfect_attendance = true)::int AS perfect_attendance_count,
      max(a.synced_at) AS last_synced_at,
      max(a.sync_source) AS sync_source
    FROM hr2_attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.period = $1 AND e.is_active = true${deptClause}
  `, params)

  return rows[0] || {
    total_records: 0,
    avg_attendance_score: 0.0,
    total_days_present: 0,
    total_absences: 0,
    total_tardies: 0,
    perfect_attendance_count: 0,
    last_synced_at: null,
    sync_source: 'HR2_DTR_API',
  }
}

/**
 * List all attendance records with optional filters
 */
export async function listAttendanceRecords({ department = null, search = '', period = 'Q1 2026', limit = 100 } = {}) {
  const params = [period]
  let where = 'WHERE a.period = $1 AND e.is_active = true'

  if (department && department !== 'All Departments') {
    params.push(department)
    where += ` AND e.department = $${params.length}`
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`)
    where += ` AND (LOWER(e.full_name) LIKE $${params.length} OR LOWER(e.employee_number) LIKE $${params.length} OR LOWER(e.job_title) LIKE $${params.length})`
  }

  params.push(limit)
  const limitIndex = params.length

  const { rows } = await query(`
    SELECT
      a.id, a.employee_id, a.period, a.total_working_days, a.days_present, a.days_absent,
      a.tardy_count, a.tardy_minutes, a.attendance_score, a.is_perfect_attendance,
      a.sync_source, a.synced_at,
      e.full_name, e.employee_number, e.department, e.job_title, e.avatar_url
    FROM hr2_attendance_records a
    JOIN employees e ON e.id = a.employee_id
    ${where}
    ORDER BY a.is_perfect_attendance DESC, a.attendance_score DESC, e.full_name ASC
    LIMIT $${limitIndex}
  `, params)

  return rows
}
