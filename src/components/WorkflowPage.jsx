import { useCallback, useEffect, useMemo, useRef, useState, Component } from 'react'
import { createPortal } from 'react-dom'
import SearchableSelector from './SearchableSelector'
import ModuleAIInsights from './ModuleAIInsights'
import WorkflowForms, { getInitialValue } from './WorkflowForms'
import WorkflowTimeline from './WorkflowTimeline'
import ModuleDashboard from './ModuleDashboard'
import useDialogFocus from '../hooks/useDialogFocus'
import { usePolling } from '../hooks/usePolling'
import { api } from '../lib/api'
import { configFor, computeModuleStats, STAGE_GUIDES, COMMENT_SUGGESTIONS, QUICK_DECISIONS, isApprovalStage } from '../workflowConfig'
import { Check, CheckCircle, AlertTriangle, Zap, Sparkles, Pencil, ClipboardList, Clock, Info, Search, ChevronDown, User, X, Plus, TrendingUp, BookOpen, Calendar, Award, Crown } from 'lucide-react'
import PageBanner from './PageBanner'

// Error boundary — catches render errors in any step form so the entire page
// doesn't go blank. Shows a recoverable error card instead.
class StepFormErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Unexpected error' }
  }
  componentDidCatch(error, info) {
    console.error('[StepForm] render error:', error, info)
  }
  componentDidUpdate(prevProps) {
    // Reset when the step changes so the next step renders fresh
    if (prevProps.stageKey !== this.props.stageKey) {
      this.setState({ hasError: false, errorMsg: '' })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px 22px', borderRadius: 12, margin: '12px 0',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <strong style={{ fontSize: 13, color: '#dc2626' }}>
            ⚠ This step encountered an error while rendering.
          </strong>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {this.state.errorMsg}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            style={{
              alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 7,
              border: '1px solid #dc2626', background: 'transparent', color: '#dc2626',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').role
  } catch {
    return undefined
  }
}

const getUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').id
  } catch {
    return undefined
  }
}

const getEmployeeId = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').employeeId
  } catch {
    return undefined
  }
}

const moduleKeys = {
  'Performance review': 'performance',
  'Skill development': 'competency',
  'Learning progress': 'learning',
  'Training management': 'training',
  'Succession planning': 'succession',
  'Social recognition': 'recognition',
}

const slugify = text =>
  text
    ?.toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .trim() || ''

const normalizeStage = stage => {
  if (!stage) return null
  if (Array.isArray(stage)) {
    const [label, description = '', roles = []] = stage
    return { key: slugify(label), label, description, roles }
  }
  return {
    key: stage.key || slugify(stage.label),
    label: stage.label || '',
    description: stage.description || '',
    roles: stage.roles || [],
  }
}

// Generic success / error notification that fades after a few seconds.
function Notice({ notice, type = 'success', onDismiss }) {
  const timerRef = useRef(null)
  useEffect(() => {
    if (notice) {
      timerRef.current = setTimeout(onDismiss, 4500)
      return () => clearTimeout(timerRef.current)
    }
  }, [notice, onDismiss])
  if (!notice) return null
  return (
    <div className={`module-notice module-notice-${type}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{type === 'success' ? <CheckCircle size={15} className="text-emerald-500" /> : <AlertTriangle size={15} className="text-amber-500" />} {notice}</span>
      <button type="button" className="notice-dismiss" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  )
}

export default function WorkflowPage({
  title,
  description,
  action,
  stages = [],
  items = [],
  itemLabel = 'Employee',
  module,
  itemIsEmployee = false,
  extraHeaderAction,
}) {
  const role = getRole()
  const userId = getUserId()
  const employeeId = getEmployeeId()
  const moduleKey = useMemo(() => {
    if (module) return module
    const t = (title || '').toLowerCase()
    if (t.includes('performance')) return 'performance'
    if (t.includes('skill') || t.includes('competency')) return 'competency'
    if (t.includes('learning')) return 'learning'
    if (t.includes('training')) return 'training'
    if (t.includes('succession')) return 'succession'
    if (t.includes('recognition')) return 'recognition'
    return 'performance'
  }, [module, title])
  const moduleCfg = useMemo(() => configFor(moduleKey), [moduleKey])
const [workflow, setWorkflow] = useState(null)
  const [workflows, setWorkflows] = useState([])
  const [completedWorkflows, setCompletedWorkflows] = useState([])
  const [completedView, setCompletedView] = useState(null)
  const [completedEvents, setCompletedEvents] = useState([])
  const [definitions, setDefinitions] = useState([])
  const [events, setEvents] = useState([])
  const [analyticsData, setAnalyticsData] = useState(null)
  const [people, setPeople] = useState([])
  const [subject, setSubject] = useState(null)
  const [selected, setSelected] = useState(items[0] || ['', '', ''])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('success')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [schedule, setSchedule] = useState({ date: '', time: '09:00', venue: 'Logistics Learning Hub' })
  // Per-step form data
  const [formData, setFormData] = useState({})
  // New workflow composer state (clean slate for each new cycle)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerEmployee, setComposerEmployee] = useState(null)
  const [composerDept, setComposerDept] = useState('')
  const [composerQuery, setComposerQuery] = useState('')
  // Unified subject selector — the live "currently evaluating" target. Updated
  // as soon as the user picks an employee in the composer or the top selector,
  // before any workflow is created.
  const [evaluatingSubject, setEvaluatingSubject] = useState(null)
  // The most recently completed workflow — retained only for the AI panel so
  // HR can generate a report immediately after completion. It is NOT the
  // active workflow and never appears in the active workspace.
  const [lastCompleted, setLastCompleted] = useState(null)
  // The most recently selected workflow id from the completed history, used to
  // target the AI Insights panel so its "Generate AI Insight" button acts on
  // that specific employee/module workflow. Selecting it never auto-generates.
  const [aiTargetWorkflowId, setAiTargetWorkflowId] = useState(null)

  // Bulk Review Cycle Launcher state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCycleTitle, setBulkCycleTitle] = useState('')
  const [bulkDept, setBulkDept] = useState('')
  const [bulkSelectedEmployeeIds, setBulkSelectedEmployeeIds] = useState([])
  const [bulkDueDate, setBulkDueDate] = useState('')
  const [bulkSkipActive, setBulkSkipActive] = useState(true)
  const [bulkSearch, setBulkSearch] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  // Searchable workflow picker state
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false)
  const [workflowPickerQuery, setWorkflowPickerQuery] = useState('')
  const workflowPickerRef = useRef(null)

  // Close workflow picker when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (workflowPickerRef.current && !workflowPickerRef.current.contains(e.target)) {
        setWorkflowPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const roleAction = typeof action === 'string' ? action : action?.[role]
  const itemOptions = useMemo(
    () => items.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [items],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
const [list, completedList, definitionResult, subjectResult] = await Promise.all([
        api.workflows(moduleKey),
        api.workflows(moduleKey, { status: 'completed' }),
        api.workflowDefinitions(),
        api.workflowSubjects(),
      ])
// Only an IN-PROGRESS workflow can be the active workspace item.
      // Completed workflows belong in history/reports/AI, never in the active view.
      const active = (list.workflows || []).find(w => w.status === 'active') || null
      setWorkflows(list.workflows || [])
      setCompletedWorkflows(completedList.workflows || [])
      setDefinitions(definitionResult.workflows[moduleKey] || [])
      setPeople(subjectResult.employees || [])
      setSubject(previous => previous || subjectResult.employees?.[0] || null)
      if (!selected[0] && subjectResult.employees?.[0]) {
        const p = subjectResult.employees[0]
        setSelected([p.full_name, `${p.job_title} - ${p.department}`, 'Active'])
      }
      if (active?.subject_name && subjectResult.employees) {
        const match = subjectResult.employees.find(p => p.full_name === active.subject_name || p.id === active.subject_employee_id)
        if (match) setEvaluatingSubject(match)
      } else if (!evaluatingSubject && subjectResult.employees?.[0]) {
        setEvaluatingSubject(subjectResult.employees[0])
      }
      setWorkflow(active)
      setEvents(active ? (await api.workflow(active.id)).events || [] : [])
      setError('')
      // Load analytics for dashboard stats
      const analytics = await api.analytics().catch(() => null)
      setAnalyticsData(analytics)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [moduleKey])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load()
  }, [load])

  // Silent background refresh every 45 s — keeps workflow status in sync without
  // showing a loading spinner. Uses the same load() that the initial mount uses.
  const silentLoad = useCallback(async () => {
    try {
      const [list, completedList] = await Promise.all([
        api.workflows(moduleKey),
        api.workflows(moduleKey, { status: 'completed' }),
      ])
      const active = (list.workflows || []).find(w => w.status === 'active') || null
      setWorkflows(list.workflows || [])
      setCompletedWorkflows(completedList.workflows || [])
      setWorkflow(active)
    } catch {
      // Silent — never surface polling errors
    }
  }, [moduleKey])

  usePolling(silentLoad, 45000)

  const normalizedStages = useMemo(() => {
    if (definitions.length) return definitions
    return stages.map(normalizeStage).filter(Boolean)
  }, [definitions, stages])

const current = normalizedStages.find(stage => stage.key === workflow?.current_stage)
  // All workflow stages are visible in the stepper so every role can see the full pipeline.
  const roleStages = useMemo(
    () => normalizedStages,
    [normalizedStages],
  )
const canStart = Boolean(normalizedStages[0]?.roles.includes(role))
  // The actor may act if their role is assigned to the current stage, OR if the
  // stage is employee-assigned and the actor IS the workflow's subject (so the
  // subject can complete their own self-assessment regardless of role label).
  const canAct = Boolean(
    workflow &&
    current &&
    (current.roles.includes(role) ||
      (current.roles.length === 1 && current.roles[0] === 'employee' && Boolean(employeeId && workflow.subject_employee_id && employeeId === workflow.subject_employee_id))),
  )
  const assigned = itemIsEmployee
    ? people.find(person => person.full_name.toLowerCase() === selected[0].toLowerCase())
    : subject
  const roleCurrentIndex = workflow ? roleStages.findIndex(stage => stage.key === workflow?.current_stage) : -1
  const display = current?.label || normalizedStages[0]?.label || 'Workflow'
  const currentDescription = current?.description || 'Review the current step details and complete when ready.'
  const detailTarget = current
  const canReturn = Boolean(workflow && canAct && roleCurrentIndex > 0)
  const canCancel = Boolean(workflow && (role === 'hr' || userId === workflow.created_by))
  const previousStageOptions = workflow && canAct
    ? normalizedStages
        .filter(stage => stage.key !== workflow.current_stage && roleStages.findIndex(s => s.key === stage.key) < roleCurrentIndex)
        .map(stage => ({ value: stage.key, label: stage.label }))
    : []

// Current step form config from moduleCfg
  const currentFormConfig = useMemo(() => {
    if (!workflow || !current) return null
    return moduleCfg.stepForms[workflow.current_stage] || null
  }, [workflow, current, moduleCfg])

  // Is the current step an approval step? If so, show "Approve & Continue" +
  // "Return for Revision"; otherwise show a single "Complete Step" action. The
  // two action styles are mutually exclusive (no duplicate buttons).
  const isApproval = useMemo(
    () => Boolean(workflow && current && isApprovalStage(current.key, currentFormConfig)),
    [workflow, current, currentFormConfig],
  )

  // Step guidance card + comment suggestion chips for the current stage.
  const currentGuide = useMemo(() => {
    if (!current) return null
    const byModule = STAGE_GUIDES[moduleKey] || {}
    return byModule[current.key] || null
  }, [current, moduleKey])

  const currentSuggestions = useMemo(() => COMMENT_SUGGESTIONS[moduleKey] || [], [moduleKey])
  const quickDecisionNote = useMemo(() => QUICK_DECISIONS[moduleKey] || null, [moduleKey])

const currentFormValue = useMemo(() => {
    const key = workflow?.current_stage || ''
    return formData[key] !== undefined ? formData[key] : {}
  }, [formData, workflow?.current_stage])

  // Sync evaluatingSubject whenever active workflow changes
  useEffect(() => {
    if (workflow?.subject_name && people.length > 0) {
      const match = people.find(p => p.full_name === workflow.subject_name || p.id === workflow.subject_employee_id)
      if (match) setEvaluatingSubject(match)
    }
  }, [workflow?.id, workflow?.subject_name, workflow?.subject_employee_id, people])

  // Bidirectional alignment: picking a subject in the unified selector (top of
  // the module) or composer fills the step form's "employee" field, and vice versa.
  const hasEmployeeField = useMemo(() =>
    Boolean(currentFormConfig && (currentFormConfig.fields || []).some(f => f.name === 'employee')),
    [currentFormConfig],
  )

  useEffect(() => {
    if (!hasEmployeeField) return
    const key = workflow?.current_stage || ''
    const activeSubjectName = workflow?.subject_name || evaluatingSubject?.full_name
    if (activeSubjectName && currentFormValue?.employee !== activeSubjectName) {
      setFormData(prev => {
        const current = prev[key] || {}
        if (current.employee === activeSubjectName) return prev
        return { ...prev, [key]: { ...current, employee: activeSubjectName } }
      })
    }
  }, [hasEmployeeField, evaluatingSubject?.full_name, workflow?.subject_name, workflow?.current_stage, currentFormValue?.employee]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the workflow moves to a new stage, seed a fresh initial value for the
  // stage's form/builder so the step always has a valid controlled value.
  useEffect(() => {
    if (!currentFormConfig) return
    const key = workflow?.current_stage || ''
    if (formData[key] !== undefined) return
    const initial = getInitialValue(currentFormConfig, role)
    if (initial !== undefined) {
      const inviteNames = (currentFormConfig.fields || []).find(f => f.name === 'invitees' || f.name === 'participants')
      const hasEmp = (currentFormConfig.fields || []).find(f => f.name === 'employee')
      const isAssignBuilder = currentFormConfig.builder === 'assignEmployees'
      const isNominationsBuilder = currentFormConfig.builder === 'nominations'
      const subjectName = workflow?.subject_name || evaluatingSubject?.full_name
      let seeded = initial
      if (hasEmp && subjectName && typeof seeded === 'object' && !Array.isArray(seeded)) {
        seeded = { ...seeded, employee: subjectName }
      }
      if (isNominationsBuilder && subjectName && Array.isArray(initial)) {
        const already = initial.some(row => row && row.employee === subjectName)
        seeded = already ? initial : [...initial, { employee: subjectName, rationale: '', targetRole: '' }]
      } else if (isAssignBuilder && subjectName && Array.isArray(initial)) {
        seeded = initial.includes(subjectName) ? initial : [...initial, subjectName]
      } else if (inviteNames && Array.isArray(initial[inviteNames.name])) {
        const list = initial[inviteNames.name]
        seeded = { ...initial, [inviteNames.name]: list.includes(subjectName) ? list : [...list, subjectName] }
      }
      setFormData(prev => (prev[key] !== undefined ? prev : { ...prev, [key]: seeded }))
    }
  }, [workflow?.current_stage, currentFormConfig, role, workflow?.subject_name, evaluatingSubject?.full_name]) // eslint-disable-line react-hooks/exhaustive-deps

const setFormValue = useCallback((patchOrValue, meta) => {
    const key = workflow?.current_stage || ''
    // If the form's "employee" field changed, sync the unified subject selector.
    const nextValue = patchOrValue && typeof patchOrValue === 'object' && !Array.isArray(patchOrValue)
      ? { ...(patchOrValue) }
      : patchOrValue
    if (nextValue && typeof nextValue === 'object' && nextValue.employee) {
      const match = people.find(p => p.full_name === nextValue.employee)
      if (match) setEvaluatingSubject(match)
    }
    if (meta?.submit) {
      // Form submitted — store the data and proceed with completion
      setFormData(prev => ({ ...prev, [key]: patchOrValue }))
      void complete()
      return
    }
    setFormData(prev => ({ ...prev, [key]: patchOrValue }))
  }, [workflow?.current_stage, people])

  // Check if form is valid for the current step
  const isFormValid = useMemo(() => {
    if (!currentFormConfig) return true // no form config = allow
    if (currentFormConfig.aiOnly) return true // no fields needed for AI steps
    if (currentFormConfig.builder === 'kpiLibrary' || currentFormConfig.builder === 'kpi') {
      const v = currentFormValue
      const kpis = Array.isArray(v) ? v : (v?.kpis || [])
      if (!kpis.length) return false
      const totalWeight = kpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0)
      if (Math.abs(totalWeight - 100) > 0.5) return false
      return kpis.every(k => k.name && String(k.name).trim() && Number(k.weight) > 0)
    }
    if (currentFormConfig.builder === 'assessment') {
      const v = currentFormValue
      const ratings = v?.kpiRatings || []
      if (!ratings.length) return false
      return ratings.every(r => (r.rating !== undefined && Number(r.rating) >= 1 && Number(r.rating) <= 5) || (r.score !== undefined && Number(r.score) >= 0 && Number(r.score) <= 100))
    }
    if (currentFormConfig.builder === 'calibration') {
      const v = currentFormValue
      const decision = v?.decision || ''
      if (!decision) return false
      if (decision.includes('Override') && (v?.finalScore === '' || v?.finalScore === undefined || v?.finalScore === null)) return false
      if ((decision.includes('Override') || decision.includes('Return')) && !String(v?.reason || '').trim()) return false
      return true
    }
    const fields = currentFormConfig.fields || []
    return fields.every(field => {
      if (!field.required) return true
      const v = currentFormValue[field.name]
      if (Array.isArray(v)) return v.length > 0
      if (field.type === 'toggle') return Boolean(v)
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
  }, [currentFormConfig, currentFormValue])

  // Live items: when the page uses employees as items, prefer real records from the API.
  const liveItems = useMemo(() => {
    if (!itemIsEmployee || !people.length) return items
    return people.map(person => [person.full_name, `${person.job_title} - ${person.department}`, 'Active', (person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()])
  }, [itemIsEmployee, people, items])

  const liveItemOptions = useMemo(
    () => liveItems.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [liveItems],
  )

const showNotice = (msg, type = 'success') => {
    setNotice(msg)
    setNoticeType(type)
  }

// Reset all per-workflow state so a brand-new workflow starts completely fresh.
  const resetWorkflowState = () => {
    setFormData({})
    setNote('')
    setWorkflow(null)
    setEvents([])
    setSelected(items[0] || ['', '', ''])
    setReturnTarget('')
    setReturnNote('')
    setCancelReason('')
  }

  // Core workflow creation. Resets all state first so nothing from the previous
  // workflow (employee, forms, ratings, KPIs, notes, AI panel) leaks into the
  // new cycle. Always creates a genuinely new workflow_id.
const start = async (options = {}) => {
    // Prefer an employee chosen in the create-step form (selection-first UX),
    // then the composer selection, then the unified subject selector, then the
    // currently assigned subject.
    const formEmployee = currentFormValue?.employee
    const selectedFromForm = formEmployee && people.find(p => p.full_name === formEmployee)
    const targetEmployee = options.employee || selectedFromForm || evaluatingSubject || (role === 'employee' ? null : assigned)
    if (role !== 'employee' && !targetEmployee) return setError(`Select a valid ${itemLabel.toLowerCase()} first.`)
    if (targetEmployee) setEvaluatingSubject(targetEmployee)
    showNotice(`Creating ${title.toLowerCase()} workflow...`)
    setError('')
    setSaving(true)
    try {
      const result = await api.createWorkflow({
        module: moduleKey,
        title: `${title}: ${targetEmployee?.full_name || selected[0]}`,
        subjectEmployeeId: role === 'employee' ? undefined : targetEmployee?.id,
        metadata: {
          selectedItem: targetEmployee?.full_name || selected[0],
          selectedItemStatus: 'Active',
          assignedEmployee: targetEmployee?.full_name,
          ...(options.trainingSchedule ? { trainingSchedule: options.trainingSchedule } : {}),
        },
      })
      if (options.trainingSchedule) {
        await api.addWorkflowNote(result.workflow.id, {
          note: `Training scheduled: ${options.trainingSchedule.date} at ${options.trainingSchedule.time}, ${options.trainingSchedule.venue}.`,
          data: { type: 'training_schedule', ...options.trainingSchedule, training: selected[0] },
        })
      }
      // Clear the composer after a successful create.
      setComposerOpen(false)
      setComposerEmployee(null)
      setComposerDept('')
      setComposerQuery('')
      resetWorkflowState()
      showNotice(`${roleAction || 'Workflow'} created. Starting at Step 1.`)
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (requestError) {
      setNotice('')
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const begin = () => {
    setError('')
    void start()
  }

  // Create a new workflow through the composer (employee pre-selected).
  const createFromComposer = () => {
    // The selection may be stored in composerEmployee (clicked a result card)
    // OR in evaluatingSubject (picked from the datalist dropdown, which clears
    // composerEmployee). Accept either so a valid selection is never rejected.
    const target = composerEmployee || evaluatingSubject
    if (!target) return setError('Select an employee to start the workflow.')
    setError('')
    setEvaluatingSubject(target)
    void start({ employee: target })
  }

  const departments = useMemo(
    () => Array.from(new Set(people.map(p => p.department).filter(Boolean))).sort(),
    [people]
  )

  const activeEmployeeIdSet = useMemo(
    () => new Set((workflows || []).map(w => w.subject_employee_id).filter(Boolean)),
    [workflows]
  )

  const filteredBulkEmployees = useMemo(() => {
    return people.filter(p => {
      const matchDept = !bulkDept || (p.department || '').toLowerCase() === bulkDept.toLowerCase()
      const matchQuery = !bulkSearch || `${p.full_name} ${p.job_title} ${p.department}`.toLowerCase().includes(bulkSearch.toLowerCase())
      return matchDept && matchQuery
    })
  }, [people, bulkDept, bulkSearch])

  const openBulkLauncher = () => {
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1
    const year = new Date().getFullYear()
    const defaultTitle = `${title} Cycle - Q${currentQuarter} ${year}`
    setBulkCycleTitle(defaultTitle)
    setBulkDept('')
    setBulkSearch('')
    setBulkSelectedEmployeeIds(people.map(p => p.id))
    setBulkDueDate('')
    setBulkSkipActive(true)
    setBulkResult(null)
    setBulkOpen(true)
  }

  const toggleBulkEmployee = (id) => {
    setBulkSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const selectAllBulkFiltered = () => {
    const filteredIds = filteredBulkEmployees.map(p => p.id)
    setBulkSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...filteredIds])))
  }

  const clearBulkSelection = () => {
    if (bulkDept || bulkSearch) {
      const filteredIdSet = new Set(filteredBulkEmployees.map(p => p.id))
      setBulkSelectedEmployeeIds(prev => prev.filter(id => !filteredIdSet.has(id)))
    } else {
      setBulkSelectedEmployeeIds([])
    }
  }

  const applyDueDatePreset = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setBulkDueDate(d.toISOString().slice(0, 10))
  }

  const submitBulkLaunch = async () => {
    if (!bulkSelectedEmployeeIds.length) {
      setError('Please select at least one employee.')
      return
    }
    if (!bulkCycleTitle.trim()) {
      setError('Please enter a cycle title.')
      return
    }
    setBulkSaving(true)
    setError('')
    try {
      const payload = {
        module: moduleKey,
        cycleTitle: bulkCycleTitle.trim(),
        employeeIds: bulkSelectedEmployeeIds,
        skipExistingActive: bulkSkipActive,
        dueDate: bulkDueDate ? new Date(`${bulkDueDate}T23:59:59.000Z`).toISOString() : undefined,
      }
      const res = await api.createBulkWorkflows(payload)
      setBulkResult(res)
      showNotice(`Successfully launched cycle "${bulkCycleTitle}": ${res.createdCount} workflows created${res.skippedCount > 0 ? `, ${res.skippedCount} skipped (already active)` : ''}.`)
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkSaving(false)
    }
  }

  const openAssignedAction = () => {
    setError('')
    const assignedWorkflow = workflows.find(entry => {
      const stage = normalizedStages.find(candidate => candidate.key === entry.current_stage)
      return stage?.roles.includes(role)
    })
    if (!assignedWorkflow) {
      showNotice(`There are no ${title.toLowerCase()} actions waiting for your role.`, 'info')
      return
    }
    void chooseWorkflow(assignedWorkflow.id)
    showNotice(`${roleAction} is ready in the selected workflow.`)
  }

  const handleHeaderAction = () => {
    if (canStart) {
      // Open the New Workflow composer so the user picks a fresh employee and
      // a brand-new cycle starts from scratch.
      setComposerOpen(true)
      return
    }
    openAssignedAction()
  }

const complete = async () => {
    setSaving(true)
    try {
      if (currentFormConfig?.builder === 'trainingInvite' && currentFormValue?.sessionId && Array.isArray(currentFormValue?.employeeIds)) {
        try {
          await api.inviteTrainingParticipants(currentFormValue.sessionId, currentFormValue.employeeIds)
        } catch (err) {
          console.warn('Participant invitation error:', err)
        }
      }

      const result = await api.advanceWorkflow(workflow.id, {
        note: note || undefined,
        data: { selectedItem: selected[0], formData: currentFormValue, ...currentFormValue },
      })
      setNote('')
      if (result.completed) {
        if (result.employee) {
          setPeople(prev => prev.map(person => person.id === result.employee.id ? { ...person, ...result.employee } : person))
          setEvaluatingSubject(prev => prev?.id === result.employee.id ? { ...prev, ...result.employee } : prev)
          setAnalyticsData(prev => prev ? {
            ...prev,
            employees: (prev.employees || []).map(employee => employee.id === result.employee.id ? { ...employee, ...result.employee } : employee),
          } : prev)
        }
        // Keep the just-completed workflow id for the AI panel (so HR can
        // generate a report immediately), then clear the active workspace so
        // the completed workflow moves to history only.
        setLastCompleted(result.workflow || workflow)
        setAiTargetWorkflowId(result.workflow?.id || workflow.id)
        setWorkflow(null)
        setEvents([])
        const updatedField = result.scoreWriteBack?.field ? ` ${result.scoreWriteBack.field.replaceAll('_', ' ')} updated to ${result.scoreWriteBack.newValue}%.` : ''
        const gapNotice = (result.gapAssignments && result.gapAssignments.length > 0)
          ? ` 🎓 ${result.gapAssignments.length} learning course(s) auto-assigned for detected skill gaps.`
          : ''
        showNotice(`Workflow completed.${updatedField}${gapNotice} ${result.metricsReady ? 'Metrics are ready for AI report generation.' : 'Employee data was updated; metrics preview will refresh shortly.'}`)
      } else {
        showNotice(`${display} completed. ${result.nextAction} is now awaiting its assigned role.`)
      }
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      // Fire targeted event so Employee Records page can update the specific
      // employee row immediately without a full reload
      if (result.employee) {
        window.dispatchEvent(new CustomEvent('pds:employee-score-updated', { detail: result.employee }))
      }
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  // Execute the current step immediately after validation — no confirmation
  // modal for non-destructive actions. The button itself performs the action.
  const handleCompleteWithValidation = () => {
    if (currentFormConfig && !isFormValid) {
      if (currentFormConfig.builder === 'kpiLibrary' || currentFormConfig.builder === 'kpi') {
        const kpis = Array.isArray(currentFormValue) ? currentFormValue : (currentFormValue?.kpis || [])
        if (!kpis.length) {
          setError('Please configure at least one KPI before proceeding.')
          return
        }
        const totalWeight = kpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0)
        if (Math.abs(totalWeight - 100) > 0.5) {
          setError(`Total KPI weight must equal 100% (currently ${totalWeight}%). Use the "Auto-Distribute" button or adjust the weights.`)
          return
        }
        const invalidKpi = kpis.find(k => !k.name || !String(k.name).trim() || !(Number(k.weight) > 0))
        if (invalidKpi) {
          setError('Each KPI must have a name and a weight greater than 0%.')
          return
        }
      }
      if (currentFormConfig.builder === 'assessment') {
        setError('Please rate all evaluation criteria (1 to 5) before completing this step.')
        return
      }
      if (currentFormConfig.builder === 'calibration') {
        const v = currentFormValue
        if (!v?.decision) {
          setError('Please select an HR Calibration Decision before completing this step.')
          return
        }
        if (v.decision.includes('Override') && (v.finalScore === '' || v.finalScore === undefined || v.finalScore === null)) {
          setError('Please enter a Final Calibrated Score (%) for the override decision.')
          return
        }
        if ((v.decision.includes('Override') || v.decision.includes('Return')) && !String(v.reason || '').trim()) {
          setError('Please provide calibration notes / justification for this decision.')
          return
        }
      }
      const missingFields = (currentFormConfig.fields || [])
        .filter(f => f.required)
        .filter(f => {
          const v = currentFormValue[f.name]
          if (Array.isArray(v)) return v.length === 0
          if (f.type === 'toggle') return !v
          return v === undefined || v === null || String(v).trim() === ''
        })
        .map(f => f.label || f.name)
      const detail = missingFields.length > 0 ? `: ${missingFields.join(', ')}` : '.'
      setError(`Please fill in all required fields before completing this step${detail}`)
      return
    }
    void complete()
  }

  // One-click approval: approve the current step and continue.
  const approveAndContinue = () => {
    if (!workflow || !canAct) return
    if (currentFormConfig && !isFormValid) {
      setError('Please complete all required fields before approving this step.')
      return
    }
    setNote(quickDecisionNote?.approve || 'Approved')
    void complete()
  }

  // One-click return for revision on an approval step.
  const returnForRevision = () => {
    if (!workflow || !canAct) return
    if (canReturn) {
      setReturnTarget(previousStageOptions[0]?.value || '')
      setReturnNote(quickDecisionNote?.reject || 'Returned for revision')
      setReturnOpen(true)
    } else {
      setNote(quickDecisionNote?.reject || 'Returned for revision')
      void complete()
    }
  }

const quickAction = action => {
    const stage = normalizedStages.find(s => s.key === action.stage)
    if (!stage) return
    if (stage.roles.includes(role)) {
      if (workflow?.current_stage === stage.key) return
      // If no workflow at this stage, start one
      if (canStart) begin()
    }
  }

  // One-click approve / reject decision for review stages.
  const quickApprove = () => {
    if (!workflow || !canAct) return
    setNote(quickDecisionNote?.approve || 'Approved')
    void complete()
  }
  const quickReject = () => {
    if (!workflow || !canAct) return
    if (canReturn) {
      setReturnTarget(previousStageOptions[0]?.value || '')
      setReturnNote(quickDecisionNote?.reject || 'Returned for revision')
      setReturnOpen(true)
    } else {
      setNote(quickDecisionNote?.reject || 'Returned for revision')
      void complete()
    }
  }

  const saveNote = async () => {
    if (!note.trim()) return setError('Add a note before saving.')
    setSaving(true)
    try {
      await api.addWorkflowNote(workflow.id, { note, data: { selectedItem: selected[0] } })
      setNote('')
      showNotice('Note saved to the database audit history.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const returnWorkflow = async () => {
    if (!workflow) return
    if (!returnTarget) return setError('Select a stage to return the workflow to.')
    setSaving(true)
    setError('')
    try {
      const result = await api.returnWorkflow(workflow.id, {
        targetStage: returnTarget,
        note: returnNote || undefined,
        data: { selectedItem: selected[0] },
      })
      setReturnOpen(false)
      setReturnTarget('')
      setReturnNote('')
      showNotice(`Workflow returned to "${result.returnedTo}" for the assigned role to redo.`)
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const cancelWorkflow = async () => {
    if (!workflow) return
    if (!cancelReason.trim()) return setError('Provide a reason before cancelling.')
    setSaving(true)
    setError('')
    try {
      await api.cancelWorkflow(workflow.id, cancelReason.trim())
      setCancelOpen(false)
      setCancelReason('')
      showNotice('Workflow cancelled and recorded in the audit history.', 'info')
      window.dispatchEvent(new CustomEvent('pds:refresh-dashboard'))
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

const chooseWorkflow = async id => {
    const active = workflows.find(entry => entry.id === id)
    if (!active) return
    setWorkflow(active)
    try {
      setEvents((await api.workflow(id)).events || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

// View a completed workflow's full history (RBAC-aware). HR / management /
  // operations_manager / supervisor can view any completed workflow in their
  // module; employees can only view workflows where they are the subject.
  // Selecting a workflow only targets the AI Insights panel — it does NOT
  // auto-generate. AI generation happens ONLY when the user clicks the
  // explicit "Generate AI Insight" button inside the AI Insights panel.
  const viewCompletedWorkflow = async (id) => {
    setError('')
    try {
      const result = await api.workflow(id)
      setCompletedView(result.workflow)
      setCompletedEvents(result.events || [])
      // Target the AI Insights panel at this specific completed workflow so HR
      // (or the employee owner) can generate its insight from the panel button.
      setAiTargetWorkflowId(id)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const closeCompletedView = () => {
    setCompletedView(null)
    setCompletedEvents([])
  }

const saveSchedule = async () => {
    if (!schedule.date) return setError('Select a training date.')
    if (!workflow) {
      setScheduleOpen(false)
      await start(schedule)
      return
    }
    setSaving(true)
    try {
      await api.addWorkflowNote(workflow.id, {
        note: `Training scheduled: ${schedule.date} at ${schedule.time}, ${schedule.venue}.`,
        data: { type: 'training_schedule', ...schedule, training: selected[0] },
      })
      setScheduleOpen(false)
      showNotice('Verified training schedule saved.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  // Focus management for each dialog.
  const scheduleRef = useDialogFocus(scheduleOpen, () => setScheduleOpen(false))
  const returnRef = useDialogFocus(returnOpen, () => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') })
  const cancelRef = useDialogFocus(cancelOpen, () => { setCancelOpen(false); setCancelReason('') })
  const bulkRef = useDialogFocus(bulkOpen, () => !bulkSaving && setBulkOpen(false))

  if (loading) return <main className="module-workspace"><div className="dashboard-skeleton"><i /><i /><i /><i /></div></main>

  const personOptions = people.map(person => ({ value: person.id, label: person.full_name, description: `${person.job_title} - ${person.department}` }))
  const stats = [
    ['Active workflows', workflows.length],
    ['Current stage', workflow ? display : 'Not started'],
    ['Audit entries', events.length],
    ['Last updated', workflow ? new Date(workflow.updated_at).toLocaleTimeString() : '-'],
  ]

  // compute overall progress based on stage index
  const stageProgress = current && normalizedStages.length
    ? Math.round(((normalizedStages.findIndex(s => s.key === current.key) + 1) / normalizedStages.length) * 100)
    : 0

  const moduleIcon = (() => {
    switch (moduleKey) {
      case 'performance': return <TrendingUp className="w-5 h-5 text-white" />
      case 'competency': return <Zap className="w-5 h-5 text-white" />
      case 'learning': return <BookOpen className="w-5 h-5 text-white" />
      case 'training': return <Calendar className="w-5 h-5 text-white" />
      case 'recognition': return <Award className="w-5 h-5 text-white" />
      case 'succession': return <Crown className="w-5 h-5 text-white" />
      default: return <Sparkles className="w-5 h-5 text-white" />
    }
  })()

  const bannerActions = (extraHeaderAction || roleAction || (canStart && (role === 'hr' || role === 'supervisor' || role === 'operations_manager'))) ? (
    <>
      {canStart && (role === 'hr' || role === 'supervisor' || role === 'operations_manager') && (
        <button
          className="saas-btn-secondary bulk-launch-header-btn"
          type="button"
          onClick={openBulkLauncher}
          disabled={saving || bulkSaving}
          title={`Launch a batch ${title.toLowerCase()} cycle for multiple employees`}
        >
          <Zap size={14} className="inline mr-1 text-amber-400" /> {moduleKey === 'performance' ? 'Launch Review Cycle' : moduleKey === 'competency' ? 'Launch Batch Plans' : moduleKey === 'succession' ? 'Launch Succession Batch' : 'Launch Batch Cycle'}
        </button>
      )}
      {roleAction && (
        <button
          className="saas-btn-primary"
          type="button"
          onClick={handleHeaderAction}
          disabled={saving}
        >
          {saving ? 'Creating...' : roleAction}
        </button>
      )}
      {extraHeaderAction}
    </>
  ) : null

  return <main className="module-workspace">
    <PageBanner
      title={title}
      description={description}
      icon={moduleIcon}
      actions={bannerActions}
    />

    {notice && <Notice notice={notice} type={noticeType} onDismiss={() => setNotice('')} />}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => { setError(''); void load() }}>Retry</button></div>}

{/* Module-specific dashboard widgets */}
    <ModuleDashboard
      moduleKey={moduleKey}
      data={analyticsData}
      workflows={workflows}
      role={role}
      onQuickAction={quickAction}
    />

    <section className="module-grid">
      <section className="module-process">
        <div className="module-process-head" style={{ position: 'relative', zIndex: 60 }}>
          <div>
            <span>{workflow ? (canAct ? 'Action required' : 'Read-only status') : 'Ready to start'}</span>
            <b>{display}</b>
          </div>
          {workflows.length > 0 && (
            <div className="workflow-header-picker" ref={workflowPickerRef} style={{ position: 'relative', zIndex: 60 }}>
              <button
                type="button"
                className="workflow-picker-trigger-btn"
                onClick={() => setWorkflowPickerOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  background: 'var(--surface-color, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-color, #1e293b)',
                  cursor: 'pointer',
                  maxWidth: 280,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <User size={13} style={{ color: '#111827', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                  {workflow?.subject_name || workflow?.title || 'Select Employee'}
                </span>
                <span style={{ fontSize: 10, background: '#f3f4f6', color: '#111827', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                  {workflows.length} active
                </span>
                <ChevronDown size={13} style={{ color: '#64748b', flexShrink: 0, transform: workflowPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {workflowPickerOpen && (
                <div
                  className="workflow-picker-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 310,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.08)',
                    zIndex: 9999,
                    overflow: 'hidden',
                  }}
                >
                  {/* Search Input */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc' }}>
                    <Search size={13} style={{ color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={workflowPickerQuery}
                      onChange={e => setWorkflowPickerQuery(e.target.value)}
                      placeholder="Search employee or role…"
                      autoFocus
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, width: '100%', color: '#1e293b' }}
                    />
                    {workflowPickerQuery && (
                      <button type="button" onClick={() => setWorkflowPickerQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Results List */}
                  <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                    {(() => {
                      const filtered = workflows.filter(entry => {
                        if (!workflowPickerQuery.trim()) return true
                        const q = workflowPickerQuery.toLowerCase()
                        return (
                          (entry.subject_name || '').toLowerCase().includes(q) ||
                          (entry.title || '').toLowerCase().includes(q) ||
                          (entry.current_stage || '').toLowerCase().includes(q)
                        )
                      })
                      if (!filtered.length) {
                        return (
                          <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                            No employee found matching "{workflowPickerQuery}"
                          </div>
                        )
                      }
                      return filtered.map(entry => {
                        const isSelected = entry.id === workflow?.id
                        const stageObj = normalizedStages.find(s => s.key === entry.current_stage)
                        const stageLabel = stageObj?.label || entry.current_stage
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => {
                              chooseWorkflow(entry.id)
                              setWorkflowPickerOpen(false)
                              setWorkflowPickerQuery('')
                            }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '8px 10px',
                              border: 'none', borderRadius: 6,
                              background: isSelected ? '#f3f4f6' : 'transparent',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', gap: 8,
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#111827' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.subject_name || entry.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageLabel}</span>
                              </div>
                            </div>
                            {isSelected && <Check size={14} style={{ color: '#111827', flexShrink: 0 }} />}
                          </button>
                        )
                      })
                    })()}
                  </div>

                  {/* Add button inside dropdown to quickly evaluate another employee */}
                  {canStart && (
                    <div style={{ padding: '6px 8px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkflowPickerOpen(false)
                          setComposerOpen(true)
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          background: '#111827',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1f2937' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#111827' }}
                      >
                        <Plus size={13} />
                        <span>Evaluate another employee</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step stepper — richer states: complete / current / upcoming / locked / ai / finalized */}
        <div className="module-steps">
          {roleStages.map((stage, index) => {
            const isAi = moduleCfg?.stepForms?.[stage.key]?.aiOnly
            const isFinalized = workflow?.status === 'completed'
            let stStatus
            if (isFinalized) {
              stStatus = 'finalized'
            } else if (workflow) {
              stStatus = index < roleCurrentIndex ? 'complete' : index === roleCurrentIndex ? 'active' : 'pending'
            } else {
              stStatus = index === 0 && canStart ? 'active' : 'locked'
            }
            const statusLabel = isFinalized
              ? 'Finalized'
              : isAi
                ? 'AI stage'
                : stStatus === 'complete' ? 'Completed'
                  : stStatus === 'active' ? 'Current step'
                    : stStatus === 'locked' ? 'Locked' : 'Upcoming'
            return (
              <div
                key={stage.key}
                className={`module-step ${stStatus} ${isAi ? 'ai-step' : ''}`}
                title={`${stage.label}: ${statusLabel}`}
              >
                <div className="step-marker">{isFinalized ? <Check size={14} /> : stStatus === 'complete' ? <Check size={14} /> : isAi ? <Sparkles size={13} /> : index + 1}</div>
                <div className="step-copy"><b>{stage.label}</b><small>{statusLabel}</small></div>
              </div>
            )
          })}
        </div>

        {/* Step details and form */}
        <div className="module-content">
          <h2>{display}</h2>
          <p>{workflow ? currentDescription : canStart ? 'Start a new workflow cycle to begin.' : 'Your role does not have a start action for this workflow.'}</p>

          {/* Dynamic subject indicator when a workflow is active */}
          {workflow && (
            <div className="module-subject-bar">
              <span className="module-current-subject">
                <strong>Evaluating Subject:</strong>{' '}
                <em className="subject-fixed">{workflow.subject_name || 'Unassigned'}</em>
              </span>
            </div>
          )}

{workflow ? (
            <>
              {/* Step guidance card — current task / action / time / checklist */}
              {currentGuide && (
                <div className="step-guide-card">
                  <div className="step-guide-head">
                    <span>Current task</span>
                    <em>~{currentGuide.time}</em>
                  </div>
                  <h4>{currentGuide.task}</h4>
                  <p>{currentGuide.action}</p>
                  <ul className="step-guide-checklist">
                    {currentGuide.checklist.map(item => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
              )}

{/* Per-step business form */}
              {currentFormConfig && !currentFormConfig.aiOnly && (
                <div className="workflow-form-wrap">
                  <StepFormErrorBoundary stageKey={workflow?.current_stage}>
                    <WorkflowForms
                      formConfig={currentFormConfig}
                      value={currentFormValue}
                      onChange={setFormValue}
                      role={role}
                      people={people}
                      suggestions={currentSuggestions}
                      events={events}
                      subject={
                        workflow
                          ? (people.find(p => (workflow.subject_employee_id && (p.id === workflow.subject_employee_id || p.employee_id === workflow.subject_employee_id)) || (workflow.subject_name && p.full_name?.toLowerCase() === workflow.subject_name?.toLowerCase())) || { id: workflow.subject_employee_id, full_name: workflow.subject_name })
                          : evaluatingSubject
                      }
                      workflow={workflow}
                    />
                  </StepFormErrorBoundary>
                </div>
              )}

              {/* AI-only step — no business form, just the AI insights panel */}
              {currentFormConfig?.aiOnly && (
                <div className="workflow-ai-step">
                  <p>This step requires reviewing the AI-generated insights and confirming completion below.</p>
                </div>
              )}

{canAct ? (
                isApproval ? (
                  <>
                    <label className="collapsible-block">
                      <span className="collapsible-toggle"><Pencil size={12} style={{ display: 'inline', marginRight: 4 }} /> Add approval note (optional)</span>
                      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add an approval note or review comment for this step." rows={2} />
                    </label>
                    <div className="module-actions single-action">
                      <button className="module-primary approve-continue" disabled={saving} onClick={approveAndContinue}>
                        {saving ? 'Approving...' : 'Approve & Continue'}
                      </button>
                      <button className="module-secondary return-button" disabled={saving} onClick={returnForRevision}>Return for Revision</button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="collapsible-block">
                      <span className="collapsible-toggle"><Pencil size={12} style={{ display: 'inline', marginRight: 4 }} /> Add note or review comment (optional)</span>
                      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add a note or review comment for this step." rows={2} />
                    </label>
                    <div className="module-actions single-action">
                      <button className="module-primary" disabled={saving} onClick={handleCompleteWithValidation}>
                        {saving ? 'Completing...' : 'Complete Step'}
                      </button>
                    </div>
                  </>
                )
              ) : (
                <div className="workflow-waiting-banner" style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(17, 24, 39, 0.06)', border: '1px solid rgba(17, 24, 39, 0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: '#111827', flexShrink: 0 }}><Clock size={18} /></div>
                  <div style={{ fontSize: 12 }}>
                    <b style={{ display: 'block', color: 'inherit', marginBottom: 2 }}>
                      Step in progress by {current?.roles?.map(r => r === 'hr' ? 'HR Admin' : r === 'supervisor' ? 'Supervisor' : r === 'employee' ? 'Employee' : r).join(' / ') || 'Reviewer'}
                    </b>
                    <span style={{ color: '#64748b' }}>
                      This step is currently being managed. You can review the details and development plan above, and you will be notified when your action is required.
                    </span>
                  </div>
                </div>
              )}
              {canCancel && (
                <div className="module-actions module-cancel-row">
                  <button className="module-secondary cancel-button" disabled={saving} onClick={() => setCancelOpen(true)}>Cancel workflow</button>
                </div>
              )}
            </>
) : (
            <div className="workflow-empty-state">
              <div className="workflow-empty-illustration"><ClipboardList size={40} style={{ opacity: 0.4 }} /></div>
              <h3>No active workflow</h3>
              <p>{canStart ? `Start a new ${title.toLowerCase()} to begin.` : 'Your role does not have a start action for this workflow.'}</p>
              {canStart && (
                <button className="module-primary" type="button" disabled={saving} onClick={() => setComposerOpen(true)}>
                  {saving ? 'Creating...' : 'Create New Workflow'}
                </button>
              )}
            </div>
          )}

{/* Completed workflow history — RBAC-aware. HR / management / operations_manager
              / supervisor can browse all completed workflows; employees can only see
              the ones where they were the subject (enforced server-side). */}
          {completedWorkflows.length > 0 && (
            <div className="completed-workflows-wrap">
              <h3 className="completed-workflows-title">Completed workflow history</h3>
              <ul className="completed-workflows-list">
                {completedWorkflows.map(entry => (
                  <li key={entry.id} className="completed-workflow-item">
                    <div className="completed-workflow-copy">
                      <b>{entry.title}</b>
                      <small>{entry.subject_name || 'Unassigned'} · completed {new Date(entry.completed_at || entry.updated_at).toLocaleDateString()}</small>
                    </div>
                    <button className="module-secondary" type="button" onClick={() => viewCompletedWorkflow(entry.id)}>
                      View history
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      <ModuleAIInsights module={moduleKey} stage={display} workflowId={aiTargetWorkflowId || workflow?.id || lastCompleted?.id} />
    </section>

    {scheduleOpen && createPortal(
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Schedule training" onClick={() => setScheduleOpen(false)}>
        <section className="schedule-dialog" ref={scheduleRef} onClick={event => event.stopPropagation()}>
          <div><h2>Schedule training</h2><p>Set session details after HR verifies enrollment.</p></div>
          <label>Training date<input type="date" value={schedule.date} onChange={event => setSchedule({ ...schedule, date: event.target.value })} /></label>
          <label>Start time<input type="time" value={schedule.time} onChange={event => setSchedule({ ...schedule, time: event.target.value })} /></label>
          <label>Venue<input value={schedule.venue} onChange={event => setSchedule({ ...schedule, venue: event.target.value })} /></label>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => setScheduleOpen(false)}>Cancel</button>
            <button className="module-primary" disabled={saving} onClick={saveSchedule}>{saving ? 'Saving...' : 'Confirm schedule'}</button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {returnOpen && createPortal(
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Return step" onClick={() => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') }}>
        <section className="schedule-dialog workflow-modal" ref={returnRef} onClick={event => event.stopPropagation()}>
          <div><h2>Return step</h2><p>Send this workflow back to an earlier stage for revision. The assigned role will be notified.</p></div>
          <label>Return to stage
            <select value={returnTarget} onChange={event => setReturnTarget(event.target.value)}>
              <option value="">Select a stage...</option>
              {previousStageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Reason for returning
            <textarea value={returnNote} onChange={event => setReturnNote(event.target.value)} placeholder="Explain what needs to be revised." />
          </label>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') }}>Cancel</button>
            <button className="module-primary" disabled={saving} onClick={returnWorkflow}>{saving ? 'Returning...' : 'Return workflow'}</button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {cancelOpen && createPortal(
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Cancel workflow" onClick={() => { setCancelOpen(false); setCancelReason('') }}>
        <section className="schedule-dialog workflow-modal" ref={cancelRef} onClick={event => event.stopPropagation()}>
          <div><h2>Cancel workflow</h2><p>This will cancel the entire workflow. The reason is recorded in the audit history.</p></div>
          <label>Reason for cancellation
            <textarea value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Explain why this workflow is being cancelled." />
          </label>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => { setCancelOpen(false); setCancelReason('') }}>Back</button>
            <button className="module-primary cancel-confirm" disabled={saving} onClick={cancelWorkflow}>{saving ? 'Cancelling...' : 'Cancel workflow'}</button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {/* Completed workflow history modal — RBAC-aware detail view */}
    {completedView && createPortal(
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Completed workflow history" onClick={closeCompletedView}>
        <section className="settings-dialog workflow-modal" onClick={event => event.stopPropagation()}>
          <div className="module-process-head">
            <span>Completed workflow</span>
            <b>{completedView.title}</b>
          </div>
          <div className="module-data">
            {completedView.subject_name && <article><small>Subject</small><b>{completedView.subject_name}</b></article>}
            <article><small>Status</small><b>{completedView.status}</b></article>
            {completedView.completed_at && <article><small>Completed</small><b>{new Date(completedView.completed_at).toLocaleString()}</b></article>}
          </div>
          <WorkflowTimeline workflow={completedView} events={completedEvents} />
          <div className="module-actions">
            <button className="module-primary" onClick={closeCompletedView}>Close</button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {/* New Workflow composer — pick a fresh employee, start a brand-new cycle */}
    {composerOpen && createPortal(
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Create new workflow" onClick={() => setComposerOpen(false)}>
        <section className="schedule-dialog workflow-modal composer-modal" onClick={event => event.stopPropagation()}>
          <div className="composer-head">
            <div>
              <h2>{moduleKey === 'training' ? 'Invite Participants to Training' : `Create New ${title}`}</h2>
              <p>{moduleKey === 'training' ? 'Select a scheduled training session and choose participants to invite.' : 'Choose the subject to evaluate, then start a fresh workflow cycle.'}</p>
            </div>
          </div>

          <label className="composer-field">
            <span>Subject to evaluate</span>
            <input
              value={composerEmployee ? composerEmployee.full_name : (evaluatingSubject ? evaluatingSubject.full_name : composerQuery)}
              onFocus={event => (event.target.value = '')}
              onChange={event => { setComposerQuery(event.target.value); setComposerEmployee(null); const match = people.find(p => p.full_name.toLowerCase() === event.target.value.trim().toLowerCase()); setEvaluatingSubject(match || null) }}
              placeholder="Search & select subject to evaluate…"
              list="composer-subject-list"
            />
            <datalist id="composer-subject-list">
              {people.map(person => <option key={person.id} value={person.full_name}>{person.job_title} · {person.department}</option>)}
            </datalist>
          </label>

          <div className="composer-results">
            {people
              .filter(person => !composerDept || (person.department || '').toLowerCase() === composerDept.toLowerCase())
              .filter(person => !composerQuery || `${person.full_name} ${person.job_title} ${person.department}`.toLowerCase().includes(composerQuery.toLowerCase()))
              .slice(0, 8)
              .map(person => (
                <button
                  key={person.id}
                  type="button"
                  className={`composer-employee ${(composerEmployee?.id === person.id || evaluatingSubject?.id === person.id) ? 'selected' : ''}`}
                  onClick={() => { setComposerEmployee(person); setComposerQuery(person.full_name); setEvaluatingSubject(person) }}
                >
                  <span className="composer-avatar">{(person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()}</span>
                  <span className="composer-employee-copy">
                    <b>{person.full_name}</b>
                    <small>{person.job_title} · {person.department}</small>
                  </span>
                </button>
              ))}
            {people.length === 0 && <p className="composer-empty">No employees available.</p>}
          </div>

          {(composerEmployee || evaluatingSubject) && (
            <div className="composer-selected">
              <b>Starting workflow for:</b>
              <span>{(composerEmployee || evaluatingSubject).full_name} — {(composerEmployee || evaluatingSubject).job_title}</span>
            </div>
          )}

          <div className="module-actions">
            <button className="module-secondary" onClick={() => setComposerOpen(false)}>Cancel</button>
            <button className="module-primary" disabled={saving || !(composerEmployee || evaluatingSubject)} onClick={createFromComposer}>
              {saving ? 'Creating...' : 'Start Workflow'}
            </button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {/* Bulk Workflow / Review Cycle Launcher Modal */}
    {bulkOpen && createPortal(
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Launch organizational review cycle" onClick={() => !bulkSaving && setBulkOpen(false)}>
        <section className="schedule-dialog bulk-launch-dialog" ref={bulkRef} onClick={event => event.stopPropagation()}>
          <div className="bulk-modal-header">
            <div>
              <h2>Launch Organizational Review Cycle</h2>
              <p>Batch create <strong>{title}</strong> workflows for departments or selected team members.</p>
            </div>
            <button type="button" className="notice-dismiss" onClick={() => !bulkSaving && setBulkOpen(false)} aria-label="Close dialog">×</button>
          </div>

          <div className="bulk-modal-body">
            {bulkResult ? (
              <div className="bulk-result-card">
                <div className="bulk-result-icon"><CheckCircle size={32} className="text-emerald-500 inline" /></div>
                <h3>Cycle Successfully Launched!</h3>
                <p><strong>{bulkResult.cycleTitle}</strong></p>
                <div className="bulk-result-stats">
                  <div className="stat-pill success">
                    <b>{bulkResult.createdCount}</b> Workflows Created
                  </div>
                  {bulkResult.skippedCount > 0 && (
                    <div className="stat-pill info">
                      <b>{bulkResult.skippedCount}</b> Skipped (Active)
                    </div>
                  )}
                  <div className="stat-pill neutral">
                    <b>{bulkResult.totalCount}</b> Total Evaluated
                  </div>
                </div>
                {bulkResult.skippedEmployees?.length > 0 && (
                  <div className="bulk-skipped-list">
                    <small>Skipped employees with existing active workflows:</small>
                    <ul>
                      {bulkResult.skippedEmployees.map(e => (
                        <li key={e.id}>{e.fullName} ({e.department})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bulk-form-grid">
                  <div className="bulk-field">
                    <label>Cycle Title / Review Name</label>
                    <input
                      className="bulk-input"
                      value={bulkCycleTitle}
                      onChange={e => setBulkCycleTitle(e.target.value)}
                      placeholder="e.g. Q4 2026 Performance Review"
                    />
                  </div>
                  <div className="bulk-field">
                    <label>Target Due Date (Optional)</label>
                    <input
                      type="date"
                      className="bulk-input"
                      value={bulkDueDate}
                      onChange={e => setBulkDueDate(e.target.value)}
                    />
                    <div className="bulk-quick-presets">
                      <button type="button" className="preset-btn" onClick={() => applyDueDatePreset(7)}>+7d</button>
                      <button type="button" className="preset-btn" onClick={() => applyDueDatePreset(14)}>+14d</button>
                      <button type="button" className="preset-btn" onClick={() => applyDueDatePreset(30)}>+30d</button>
                      {bulkDueDate && <button type="button" className="preset-btn" onClick={() => setBulkDueDate('')}>Clear</button>}
                    </div>
                  </div>
                </div>

                <div className="bulk-toggle-wrap">
                  <input
                    type="checkbox"
                    id="bulk-skip-active-toggle"
                    checked={bulkSkipActive}
                    onChange={e => setBulkSkipActive(e.target.checked)}
                  />
                  <label htmlFor="bulk-skip-active-toggle" className="bulk-toggle-copy">
                    <b>Skip employees with active {moduleKey} workflows</b>
                    <small>Prevents duplicate active cycles for the same employee in this module.</small>
                  </label>
                </div>

                <div>
                  <span className="bulk-section-title">Filter by Department</span>
                  <div className="bulk-dept-pills">
                    <button
                      type="button"
                      className={`dept-pill ${!bulkDept ? 'active' : ''}`}
                      onClick={() => setBulkDept('')}
                    >
                      All Departments ({people.length})
                    </button>
                    {departments.map(dept => {
                      const count = people.filter(p => p.department === dept).length
                      return (
                        <button
                          key={dept}
                          type="button"
                          className={`dept-pill ${bulkDept === dept ? 'active' : ''}`}
                          onClick={() => setBulkDept(dept)}
                        >
                          {dept} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="bulk-employee-toolbar">
                    <input
                      className="bulk-emp-search"
                      placeholder="Search employees by name, title..."
                      value={bulkSearch}
                      onChange={e => setBulkSearch(e.target.value)}
                    />
                    <div className="bulk-selection-actions">
                      <button type="button" className="bulk-text-btn" onClick={selectAllBulkFiltered}>
                        Select all {bulkDept ? bulkDept : 'filtered'}
                      </button>
                      <span className="bulk-selection-count">
                        {bulkSelectedEmployeeIds.length} of {people.length} selected
                      </span>
                      <button type="button" className="bulk-text-btn" onClick={clearBulkSelection}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="bulk-employee-list">
                    {filteredBulkEmployees.map(person => {
                      const isSelected = bulkSelectedEmployeeIds.includes(person.id)
                      const hasActive = activeEmployeeIdSet.has(person.id)
                      return (
                        <div
                          key={person.id}
                          className={`bulk-employee-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleBulkEmployee(person.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            aria-label={`Select ${person.full_name}`}
                          />
                          <span className="bulk-emp-avatar">
                            {(person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()}
                          </span>
                          <div className="bulk-emp-info">
                            <b>{person.full_name}</b>
                            <small>{person.job_title} · {person.department}</small>
                          </div>
                          <div className="bulk-emp-badges">
                            <span className="bulk-dept-tag">{person.department}</span>
                            {hasActive && (
                              <span className="bulk-active-tag" title="An active workflow already exists for this employee">
                                Active workflow
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {filteredBulkEmployees.length === 0 && (
                      <p className="composer-empty" style={{ padding: '16px', textAlign: 'center' }}>No employees found matching filter.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bulk-modal-footer">
            {bulkResult ? (
              <>
                <span className="bulk-summary-preview">Cycle initialized in database</span>
                <button className="module-primary" type="button" onClick={() => setBulkOpen(false)}>Done</button>
              </>
            ) : (
              <>
                <span className="bulk-summary-preview">
                  Will create up to <strong>{bulkSelectedEmployeeIds.length}</strong> {moduleKey} workflows
                </span>
                <div className="bulk-modal-actions">
                  <button className="module-secondary" type="button" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="module-primary bulk-launch-btn"
                    type="button"
                    disabled={bulkSaving || bulkSelectedEmployeeIds.length === 0 || !bulkCycleTitle.trim()}
                    onClick={submitBulkLaunch}
                  >
                    {bulkSaving ? 'Launching Batch...' : <><Zap size={14} className="inline mr-1 text-amber-400" /> Launch {bulkSelectedEmployeeIds.length} Workflows</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>,
      document.body
    )}
  </main>
}
