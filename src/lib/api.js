const BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.includes('hostforge')
    ? 'https://performance-development-api-horecaos.hostforgeplatforms.com'
    : ''
)

let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('pds-refresh-token')
  if (!refreshToken) return null
  try {
    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Refresh failed')
    localStorage.setItem('pds-token', body.token)
    if (body.refreshToken) localStorage.setItem('pds-refresh-token', body.refreshToken)
    return body.token
  } catch {
    // Refresh failed — clear session
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    return null
  }
}

async function request(path, options = {}, _retried = false) {
  // Public endpoints do not require a logged-in user token
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-2fa',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
    '/api/certificates/verify',
  ]
  const isPublicEndpoint = publicEndpoints.some(p => path.startsWith(p))
  const token = localStorage.getItem('pds-token')
  if (!isPublicEndpoint && !token) {
    window.dispatchEvent(new CustomEvent('pds:session-expired', { detail: { message: 'Your session has expired. Please sign in again.' } }))
    throw new Error('Authentication is required.')
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  // If access token expired (401) and not already retried, try to refresh once (unless calling a public endpoint).
  if (response.status === 401 && !_retried && !isPublicEndpoint) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
    const newToken = await refreshPromise
    if (newToken) {
      return request(path, options, true)
    }
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    window.dispatchEvent(new CustomEvent('pds:session-expired', { detail: { message: body.error || body.message || 'Your session has expired. Please sign in again.' } }))
    throw new Error(body.error || body.message || 'Your session has expired. Please sign in again.')
  }
  if (!response.ok) throw new Error(body.error || body.message || 'Request failed. Please check backend connection.')
  return body
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verify2FA: (tempToken, code) => request('/api/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),
  get2FAStatus: () => request('/api/auth/2fa/status'),
  setup2FA: () => request('/api/auth/2fa/setup', { method: 'POST', body: '{}' }),
  enable2FA: (code) => request('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2FA: (password) => request('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }),
  refreshToken: (refreshToken) => request('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken) => request('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  register: (token, password) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ token, password }) }),
  invite: (data) => request('/api/auth/invite', { method: 'POST', body: JSON.stringify(data) }),
workflows: (module, { page, limit, status } = {}) => {
    const qs = new URLSearchParams()
    if (module) qs.set('module', module)
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    if (status) qs.set('status', status)
    const queryStr = qs.toString()
    return request(`/api/workflows${queryStr ? `?${queryStr}` : ''}`)
  },
  workflow: (id) => request(`/api/workflows/${id}`),
  workflowDefinitions: () => request('/api/workflows/definitions'),
  workflowSubjects: () => request('/api/workflows/subjects'),
  createWorkflow: (data) => request('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
  createBulkWorkflows: (data) => request('/api/workflows/bulk', { method: 'POST', body: JSON.stringify(data) }),
  advanceWorkflow: (id, data = {}) => request(`/api/workflows/${id}/advance`, { method: 'POST', body: JSON.stringify(data) }),
  returnWorkflow: (id, data = {}) => request(`/api/workflows/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
  cancelWorkflow: (id, reason) => request(`/api/workflows/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  addWorkflowNote: (id, data) => request(`/api/workflows/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  assignLearningGap: (data) => request('/api/workflows/assign-learning-gap', { method: 'POST', body: JSON.stringify(data) }),
  getCompetencyComparison: (workflowId) => request(`/api/workflows/${workflowId}/competency-comparison`),
  getEmployeeCompetencyComparison: (employeeId) => request(`/api/workflows/competency-comparison/employee/${employeeId}`),
  successionPositions: () => request('/api/succession/positions'),
  successionCandidates: () => request('/api/succession/candidates'),
  successionAssess: (employeeId) => request('/api/succession/assess', { method: 'POST', body: JSON.stringify({ employeeId }) }),
  successionReview: (workflowId, data) => request(`/api/succession/workflows/${workflowId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  successionDirectApprove: (data) => request('/api/succession/direct-approve', { method: 'POST', body: JSON.stringify(data) }),
  successionRecords: () => request('/api/succession/records'),
  employeeSuccessionHistory: (employeeId) => request(`/api/succession/employee/${employeeId}/history`),
  analytics: () => request('/api/analytics/dashboard'),
  systemUsage: () => request('/api/analytics/system-usage'),
  systemHealth: () => request('/api/analytics/system-health'),
  analyticsMe: () => request('/api/analytics/me'),
  generateInsights: (employeeName) => request('/api/analytics/insights', { method: 'POST', body: JSON.stringify(employeeName ? { employeeName } : {}) }),
generateModuleInsights: (module, stage) => request('/api/analytics/module-insights', { method: 'POST', body: JSON.stringify({ module, stage }) }),
  executiveReport: () => request('/api/analytics/executive-report'),
  generateExecutiveReport: () => request('/api/analytics/executive-report', { method: 'POST', body: '{}' }),
workflowReports: (id) => request(`/api/workflows/${id}/ai-reports`),
  generateWorkflowReport: (id) => request(`/api/workflows/${id}/generate-report`, { method: 'POST', body: '{}' }),
  downloadReportPdf: async (id) => {
    const token = localStorage.getItem('pds-token')
    const response = await fetch(`${BASE_URL}/api/analytics/reports/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error || 'PDF download failed.')
    }
    return response.blob()
  },
notifications: ({ page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    const queryStr = qs.toString()
    return request(`/api/notifications${queryStr ? `?${queryStr}` : ''}`)
  },
  readNotifications: () => request('/api/notifications/read', { method: 'POST', body: '{}' }),
  emailOutbox: () => request('/api/notifications/outbox'),
  sendTestEmail: (data) => request('/api/notifications/test-email', { method: 'POST', body: JSON.stringify(data) }),
  certificateTemplates: () => request('/api/certificates/templates'),
  createCertificateTemplate: (data) => request('/api/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateCertificateTemplate: (id, data) => request(`/api/certificates/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  retireCertificateTemplate: (id) => request(`/api/certificates/templates/${id}`, { method: 'DELETE' }),
  certificates: ({ page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    const queryStr = qs.toString()
    return request(`/api/certificates${queryStr ? `?${queryStr}` : ''}`)
  },
  issueCertificates: (data) => request('/api/certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
  revokeCertificate: (id, reason) => request(`/api/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
regenerateCertificate: (id) => request(`/api/certificates/${id}/regenerate`, { method: 'POST', body: '{}' }),
  // Public certificate verification — no auth required
  verifyCertificate: (verificationCode) => request(`/api/certificates/verify/${verificationCode}`),
  // Expiry automation
  checkExpiredCertificates: () => request('/api/certificates/check-expiry', { method: 'POST', body: '{}' }),
  // Employee management
  employees: () => request('/api/employees'),
  employeesAll: () => request('/api/employees/all'),
  employee: (id) => request(`/api/employees/${id}`),
  createEmployee: (data) => request('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/api/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateEmployee: (id) => request(`/api/employees/${id}/deactivate`, { method: 'POST', body: '{}' }),
  reactivateEmployee: (id) => request(`/api/employees/${id}/reactivate`, { method: 'POST', body: '{}' }),
  employeeHistory: (id) => request(`/api/employees/${id}/history`),
  departments: () => request('/api/employees/departments'),
// Audit log
  auditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/audit-logs${qs ? `?${qs}` : ''}`)
  },
// Learning Resource / Course Library
  learningResources: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.category) qs.set('category', params.category)
    if (params.providerType) qs.set('providerType', params.providerType)
    if (params.competency) qs.set('competency', params.competency)
    if (params.includeArchived) qs.set('includeArchived', 'true')
    const queryStr = qs.toString()
    return request(`/api/learning${queryStr ? `?${queryStr}` : ''}`)
  },
  createLearningResource: (data) => request('/api/learning', { method: 'POST', body: JSON.stringify(data) }),
  updateLearningResource: (id, data) => request(`/api/learning/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveLearningResource: (id) => request(`/api/learning/${id}`, { method: 'DELETE' }),
learningCompetencies: () => request('/api/learning/competencies'),
  learningSkillGaps: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.employeeId) qs.set('employeeId', params.employeeId)
    const queryStr = qs.toString()
    return request(`/api/learning/skill-gaps${queryStr ? `?${queryStr}` : ''}`)
  },
  learningRecommendations: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.employeeId) qs.set('employeeId', params.employeeId)
    const queryStr = qs.toString()
    return request(`/api/learning/recommendations${queryStr ? `?${queryStr}` : ''}`)
  },
  generateDevelopmentPlan: (data) => request('/api/learning/development-plan', { method: 'POST', body: JSON.stringify(data) }),
  assignLearning: (data) => request('/api/learning/assign', { method: 'POST', body: JSON.stringify(data) }),
  learningAssignments: () => request('/api/learning/assignments'),
  // Self-reported progress + status: employee drives their own study progress
  // (0-100) and a status flag (not_started / studying / completed / need_help).
updateLearningProgress: (id, progress) => request(`/api/learning/assignments/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
  updateLearningStatus: (id, status) => request(`/api/learning/assignments/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  recordLearningCompletion: (data) => request('/api/learning/completions', { method: 'POST', body: JSON.stringify(data) }),
  learningCompletions: () => request('/api/learning/completions'),
// Workflow due dates & overdue
  setWorkflowDueDate: (id, dueDate) => request(`/api/workflows/${id}/due-date`, { method: 'POST', body: JSON.stringify({ dueDate }) }),
  overdueWorkflows: (days = 3) => request(`/api/workflows/overdue?days=${days}`),
  // Database-grounded AI Chat Assistant
  chatAssistant: (data) => request('/api/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Session-based Training Management System
  trainingSessions: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.category) qs.set('category', params.category)
    if (params.query) qs.set('query', params.query)
    const queryStr = qs.toString()
    return request(`/api/training/sessions${queryStr ? `?${queryStr}` : ''}`)
  },
  trainingSession: (id) => request(`/api/training/sessions/${id}`),
  createTrainingSession: (data) => request('/api/training/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateTrainingSession: (id, data) => request(`/api/training/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancelTrainingSession: (id) => request(`/api/training/sessions/${id}/cancel`, { method: 'POST', body: '{}' }),
  inviteTrainingParticipants: (sessionId, employeeIds) => request(`/api/training/sessions/${sessionId}/participants`, { method: 'POST', body: JSON.stringify({ employeeIds }) }),
  removeTrainingParticipant: (sessionId, employeeId) => request(`/api/training/sessions/${sessionId}/participants/${employeeId}`, { method: 'DELETE' }),
  recordTrainingAttendance: (sessionId, records) => request(`/api/training/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ records }) }),
  scanTrainingAttendance: (sessionId, data) => request(`/api/training/sessions/${sessionId}/scan-attendance`, { method: 'POST', body: JSON.stringify(data) }),
  selfCheckinTrainingSession: (sessionId, data = {}) => request(`/api/training/sessions/${sessionId}/self-checkin`, { method: 'POST', body: JSON.stringify(data) }),
  submitTrainingEvaluation: (sessionId, data) => request(`/api/training/sessions/${sessionId}/evaluation`, { method: 'POST', body: JSON.stringify(data) }),
  completeTrainingSession: (sessionId) => request(`/api/training/sessions/${sessionId}/complete`, { method: 'POST', body: '{}' }),
  trainingSessionAnalytics: (sessionId) => request(`/api/training/sessions/${sessionId}/analytics`),
  generateTrainingAiInsights: (sessionId) => request(`/api/training/sessions/${sessionId}/ai-insights`, { method: 'POST', body: '{}' }),
  employeeTrainingSessions: (employeeId) => request(`/api/training/sessions?employeeId=${employeeId}`),
  trainingStats: () => request('/api/training/stats'),

  // Visual Org Chart
  orgTree: () => request('/api/employees/org-tree'),

  // Social Recognition Wall & Feed
  recognitionColleagues: () => request('/api/recognition/colleagues'),
  recognitionFeed: () => request('/api/recognition/feed'),
  recognitionPending: () => request('/api/recognition/pending'),
  postRecognition: (data) => request('/api/recognition/post', { method: 'POST', body: JSON.stringify(data) }),
  validateRecognition: (id, note = '') => request(`/api/recognition/${id}/validate`, { method: 'POST', body: JSON.stringify({ note }) }),
  approveRecognition: (id, note = '', isOfficialAward) => request(`/api/recognition/${id}/approve`, { method: 'POST', body: JSON.stringify({ note, isOfficialAward }) }),
  rejectRecognition: (id, note = '') => request(`/api/recognition/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  reactRecognition: (id, reaction) => request(`/api/recognition/${id}/react`, { method: 'POST', body: JSON.stringify({ reaction }) }),
  commentRecognition: (id, text) => request(`/api/recognition/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) }),
  recognitionLeaderboard: (month) => request(`/api/recognition/leaderboard${month ? `?month=${month}` : ''}`),
  refreshRecognitionLeaderboard: (month) => {
    const fallback = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` })()
    return request('/api/recognition/leaderboard/refresh', { method: 'POST', body: JSON.stringify({ month: month || fallback }) })
  },
  resetRecognitionCycle: (targetMonth) => request('/api/recognition/cycle/reset', { method: 'POST', body: JSON.stringify({ targetMonth }) }),
  getActiveRecognitionCycle: () => request('/api/recognition/cycle/active'),

  // CSV exports (client-side from fetched data — no extra endpoint needed)
  exportEmployeesCsv: async () => {
    const result = await request('/api/employees/all')
    return result.employees || []
  },
  exportAuditLogsCsv: async (params = {}) => {
    const qs = new URLSearchParams({ ...params, limit: 1000 }).toString()
    const result = await request(`/api/audit-logs${qs ? '?' + qs : ''}`)
    return result.logs || []
  },

  // Self-service profile (all authenticated users)
  getProfileMe: () => request('/api/employees/profile/me'),
  updateProfileMe: (data) => request('/api/employees/profile/me', { method: 'PATCH', body: JSON.stringify(data) }),
  updateAccountMe: (data) => request('/api/auth/profile/account', { method: 'PATCH', body: JSON.stringify(data) }),

  // HR2 Attendance Integration
  attendanceList: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.department) qs.set('department', params.department)
    if (params.search) qs.set('search', params.search)
    if (params.period) qs.set('period', params.period)
    const queryStr = qs.toString()
    return request(`/api/attendance${queryStr ? `?${queryStr}` : ''}`)
  },
  attendanceSummary: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.department) qs.set('department', params.department)
    if (params.period) qs.set('period', params.period)
    const queryStr = qs.toString()
    return request(`/api/attendance/summary${queryStr ? `?${queryStr}` : ''}`)
  },
  employeeAttendance: (employeeId, period = 'Q1 2026') => request(`/api/attendance/employee/${employeeId}?period=${encodeURIComponent(period)}`),
  attendanceSync: (period = 'Q1 2026') => request('/api/attendance/sync', { method: 'POST', body: JSON.stringify({ period }) }),
  getReportData: (reportType, params = {}) => {
    const qs = new URLSearchParams()
    if (params.department) qs.set('department', params.department)
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    if (params.period) qs.set('period', params.period)
    const queryStr = qs.toString()
    return request(`/api/analytics/reports/${reportType}${queryStr ? `?${queryStr}` : ''}`)
  },
}

