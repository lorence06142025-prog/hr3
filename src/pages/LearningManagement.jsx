import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import ModuleAIInsights from '../components/ModuleAIInsights'
import CourseContentViewer from '../components/CourseContentViewer'
import { CheckCircle, Target, Play, FileText, BookOpen, X, Sparkles, Compass, AlertTriangle, ArrowRight, Award, Zap, ChevronRight } from 'lucide-react'
import '../learningLibrary.css'

const CATEGORIES = ['Leadership', 'Customer Service', 'Fleet Safety', 'Dispatch Operations', 'Warehouse Operations', 'Compliance', 'Communication', 'Technical Skills']
const PROV_TYPES = ['internal', 'external']

// Self-reported study statuses.
const STUDY_STATUSES = [
  ['not_started', 'Not started'],
  ['studying', 'Studying'],
  ['completed', 'Completed'],
  ['need_help', 'Need help'],
]

const STATUS_LABELS = Object.fromEntries(STUDY_STATUSES)
const STATUS_PILL = {
  not_started: 'status not-started',
  studying: 'status studying',
  completed: 'status completed',
  need_help: 'status need-help',
}

function initials(name = '') {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
}

export default function LearningManagement() {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const hr = role === 'hr'
  const supervisor = role === 'supervisor'
  const canManage = hr
  const canAssign = hr || supervisor
  const employee = role === 'employee'

  const [resources, setResources] = useState([])
  const [employees, setEmployees] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [assignments, setAssignments] = useState([])
  const [completions, setCompletions] = useState([])

  const [tab, setTab] = useState('library')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [provType, setProvType] = useState('')
  const [compFilter, setCompFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal', durationHours: '', objectives: '', url: '', videoUrl: '', pdfUrl: '', lessonContent: '', competencies: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Course Content Viewer
  const [viewResource, setViewResource] = useState(null)

  // Assign flow
  const [assignResource, setAssignResource] = useState(null)
  const [assignIds, setAssignIds] = useState([])
  const [dueDate, setDueDate] = useState('')
  const [empQuery, setEmpQuery] = useState('')

  // Completion flow (HR/supervisor official verification)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [assessmentNote, setAssessmentNote] = useState('')
  const [assessmentPass, setAssessmentPass] = useState('Pass')

  // Recommendation & AI Development Plan state
  const [recommendationsData, setRecommendationsData] = useState(null)
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [aiPlan, setAiPlan] = useState(null)
  const [aiGeneratingPlan, setAiGeneratingPlan] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)

  const load = async () => {
    try {
      const calls = []
      if (!employee) {
        calls.push(api.learningResources(showArchived ? { includeArchived: true } : {}), api.learningAssignments(), api.workflowSubjects())
      } else {
        calls.push(api.learningResources(), api.learningAssignments(), api.learningCompletions(), api.learningRecommendations().catch(() => null))
      }
      calls.push(api.learningCompetencies())
      const results = await Promise.all(calls)
      setResources(results[0].resources || [])
      setAssignments(results[1].assignments || [])
      if (employee) {
        setCompletions(results[2].completions || [])
        setRecommendationsData(results[3] || null)
      } else {
        setEmployees(results[2].employees || [])
        setCompletions([])
        const comps = await api.learningCompletions().catch(() => ({ completions: [] }))
        setCompletions(comps.completions || [])
      }
      setCompetencies(results[results.length - 1].competencies || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  useEffect(() => { load() }, [showArchived])

  // Fetch department & role specific recommendations
  const loadRecommendations = async (empId) => {
    try {
      const res = await api.learningRecommendations(empId ? { employeeId: empId } : {})
      setRecommendationsData(res)
    } catch (e) {
      console.warn('Could not load recommendations:', e.message)
    }
  }

  useEffect(() => {
    if (tab === 'recommendations') {
      loadRecommendations(selectedEmpId)
    }
  }, [tab, selectedEmpId])

  // Generate AI Skill-Gap Development Plan
  const triggerGeneratePlan = async (empId) => {
    const targetId = empId || selectedEmpId || recommendationsData?.employee?.id
    if (!targetId) {
      setError('Please select an employee to generate an AI development plan.')
      return
    }
    setAiGeneratingPlan(true)
    setError('')
    try {
      const result = await api.generateDevelopmentPlan({ employeeId: targetId })
      setAiPlan(result.plan)
      setPlanModalOpen(true)
    } catch (err) {
      setError(err.message || 'Failed to generate AI development plan.')
    } finally {
      setAiGeneratingPlan(false)
    }
  }

  const filtered = useMemo(() => {
    let list = resources
    if (employee) {
      const recIds = new Set((recommendationsData?.recommendedResources || []).map(r => r.id))
      const assignedIds = new Set(assignments.map(a => a.resource_id))

      list = resources.filter(r => {
        // If course is explicitly recommended for detected gaps or assigned to this employee
        if (recIds.has(r.id) || assignedIds.has(r.id)) return true

        // Fallback: If no gap recommendations or assignments are on record yet, show department/role-appropriate courses
        if (!recIds.size && !assignedIds.size) {
          const userDept = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').department || '' } catch { return '' } })()
          if (!userDept) return true
          const text = `${r.title} ${r.description} ${r.category} ${(r.competencies || []).join(' ')}`.toLowerCase()
          const dept = userDept.toLowerCase()
          const sharedTerms = ['leadership', 'communication', 'compliance', 'safety', 'teamwork']
          const departmentTerms = {
            'fleet & transportation': ['fleet', 'driver', 'vehicle', 'cargo', 'transport', 'delivery', 'route'],
            'dispatch & routing': ['dispatch', 'route', 'load', 'tms', 'gps', 'planning', 'exception'],
            'warehouse & inventory': ['warehouse', 'inventory', 'forklift', 'freight', 'picking', 'packing', 'wms'],
            'customer service': ['customer', 'shipment', 'claim', 'proof of delivery', 'service recovery'],
            'safety & compliance': ['safety', 'compliance', 'regulatory', 'incident', 'risk'],
            'finance & administration': ['finance', 'billing', 'invoice', 'audit', 'cost', 'accounts'],
            'human resources': ['onboarding', 'employee', 'people', 'labor', 'recruitment', 'hr'],
            'executive office': ['leadership', 'management', 'strategy', 'finance', 'operations'],
          }
          const matchedDepartment = Object.keys(departmentTerms).find(name => dept.includes(name))
          if (!matchedDepartment) return true
          return [...sharedTerms, ...departmentTerms[matchedDepartment]].some(term => text.includes(term))
        }
        return false
      })
    }

    return list.filter(r => {
      const text = `${r.title} ${r.description} ${r.provider || ''} ${r.category || ''} ${(r.competencies || []).join(' ')}`.toLowerCase()
      const matchQ = !query || text.includes(query.toLowerCase())
      const matchC = !category || r.category === category
      const matchP = !provType || r.provider_type === provType
      const matchComp = !compFilter || (r.competencies || []).includes(compFilter)
      return matchQ && matchC && matchP && matchComp
    })
  }, [resources, employee, recommendationsData, assignments, query, category, provType, compFilter])

  // Module stats for the metrics strip (matches other modules' live widgets).
  const moduleStats = useMemo(() => [
    ['Courses in library', employee ? filtered.length : resources.filter(r => r.is_active !== false).length],
    ['Assigned', assignments.length],
    ['Confirmed completions', completions.length],
    ['Need help', assignments.filter(a => a.status === 'need_help').length],
  ], [resources, assignments, completions, employee, filtered])

  const filteredEmployees = useMemo(() => {
    return employees.filter(p => `${p.full_name} ${p.department} ${p.job_title}`.toLowerCase().includes(empQuery.toLowerCase()))
  }, [employees, empQuery])

  const save = async event => {
    event.preventDefault()
    try {
      const data = { ...form, durationHours: form.durationHours ? Number(form.durationHours) : null }
      const result = editing
        ? await api.updateLearningResource(editing.id, data)
        : await api.createLearningResource(data)
      setResources(items => editing
        ? items.map(i => i.id === result.resource.id ? result.resource : i)
        : [result.resource, ...items])
      setShowForm(false); setEditing(null)
      setNotice(editing ? 'Course updated.' : 'Course added to the library.')
    } catch (requestError) { setError(requestError.message) }
  }

  const editResource = resource => {
    setForm({
      title: resource.title, description: resource.description, category: resource.category,
      provider: resource.provider || '', providerType: resource.provider_type || 'internal',
      durationHours: resource.duration_hours || '', objectives: resource.objectives || '',
      url: resource.url || '', videoUrl: resource.video_url || resource.videoUrl || '',
      pdfUrl: resource.pdf_url || resource.pdfUrl || '',
      lessonContent: resource.lesson_content || resource.lessonContent || '',
      competencies: resource.competencies || [],
    })
    setEditing(resource); setShowForm(true)
  }

  const archive = async resource => {
    if (!window.confirm(`Archive "${resource.title}"? It will be hidden from the library.`)) return
    try { await api.archiveLearningResource(resource.id); setResources(items => items.filter(i => i.id !== resource.id)); setNotice('Course archived.') }
    catch (requestError) { setError(requestError.message) }
  }

  const assign = async () => {
    if (!assignResource || !assignIds.length) return setError('Select a course and at least one employee.')
    try {
      await api.assignLearning({ resourceId: assignResource.id, employeeIds: assignIds, dueDate: dueDate || null })
      setNotice(`Assigned "${assignResource.title}" to ${assignIds.length} employee(s).`)
      setAssignResource(null); setAssignIds([]); setDueDate('')
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (requestError) { setError(requestError.message) }
  }

  // Self-reported progress/status update — employees, HR and supervisors.
  const updateAssignment = async (assignment, patch) => {
    try {
      const merged = { progress: assignment.progress || 0, status: assignment.status || 'not_started', ...patch }
      await api.updateLearningProgress(assignment.id, merged.progress)
      if (merged.status !== assignment.status) await api.updateLearningStatus(assignment.id, merged.status)
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (requestError) { setError(requestError.message) }
  }

  const updateProgress = (assignment, progress) => updateAssignment(assignment, { progress })

  const updateStatus = (assignment, status) => updateAssignment(assignment, { status })

  const recordCompletion = async () => {
    if (!completeTarget) return
    try {
      await api.recordLearningCompletion({
        resourceId: completeTarget.resource_id,
        employeeId: completeTarget.employee_id,
        assessment: { result: assessmentPass, note: assessmentNote, recordedAt: new Date().toISOString() },
      })
      setNotice(`Completion verified for "${completeTarget.resource_title}".`)
      setCompleteTarget(null); setAssessmentNote(''); setAssessmentPass('Pass')
      const [assignResult, compResult] = await Promise.all([api.learningAssignments(), api.learningCompletions()])
      setAssignments(assignResult.assignments || [])
      setCompletions(compResult.completions || [])
    } catch (requestError) { setError(requestError.message) }
  }

  const completedIds = useMemo(() => new Set(completions.map(c => `${c.resource_id}:${c.employee_id}`)), [completions])

  const resourcesForAssign = resources.filter(r => r.is_active !== false)

  return <main className="module-workspace learning-workspace">
    <div className="module-heading">
      <div>
        <h1>Course Library</h1>
        <p>Curate legitimate learning resources, assign them to employees, and track self-reported study progress.</p>
      </div>
      {canManage && <div className="module-heading-actions"><button className="module-primary" type="button" onClick={() => { setForm({ title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal', durationHours: '', objectives: '', url: '', videoUrl: '', pdfUrl: '', lessonContent: '', competencies: [] }); setEditing(null); setShowForm(true) }}>Add course</button></div>}
    </div>

    {notice && <div className="module-notice"><span><CheckCircle className="inline w-4 h-4 mr-1 text-emerald-500" /> {notice}</span><button type="button" className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    {/* Module metrics strip — consistent with other modules */}
    <section className="module-metrics">
      {moduleStats.map(([label, value], index) => <article key={label}><span>{index + 1}</span><div><small>{label}</small><b>{value}</b><em>Live database value</em></div></article>)}
    </section>

    <nav className="learning-tabs" aria-label="Learning views">
      {[
        ['library', 'Course Library'],
        ['recommendations', 'Recommended for You'],
        ...(canAssign ? [['assign', 'Assign Courses']] : []),
        ['progress', 'My Progress'],
        ['gaps', 'Skill Gap Assignments'],
        ['completions', 'Verified Completions'],
        ...(hr ? [['ai', 'AI Insights']] : []),
      ].map(([key, label]) => (
        <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
          {key === 'recommendations' ? <><Sparkles className="inline w-3.5 h-3.5 mr-1 text-gray-700" /> {label}</> : key === 'gaps' ? <><Target className="inline w-3.5 h-3.5 mr-1" /> {label}</> : label}
        </button>
      ))}
    </nav>

    {tab === 'library' && (
      <section className="learning-section">
        {employee && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(17,24,39,0.06)', borderRadius: 10, border: '1px solid rgba(17,24,39,0.16)', marginBottom: 14, fontSize: 11, color: '#1f2937' }}>
            <Sparkles size={15} className="text-gray-900 flex-shrink-0" />
            <span>
              <strong>Personalized Course Library:</strong> Showing courses recommended for your role and assigned development plan.
            </span>
          </div>
        )}
        <div className="learning-toolbar">
          <label className="learning-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses, providers, competencies…" aria-label="Search courses" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear">×</button>}</label>
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={provType} onChange={e => setProvType(e.target.value)} aria-label="Filter provider type"><option value="">All sources</option><option value="internal">Internal</option><option value="external">External</option></select>
          <select value={compFilter} onChange={e => setCompFilter(e.target.value)} aria-label="Filter competency"><option value="">All competencies</option>{competencies.map(c => <option key={c}>{c}</option>)}</select>
          {canManage && <label className="learning-archived"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>}
        </div>
        <div className="course-grid">
          {filtered.map(resource => {
            const hasVideo = !!(resource.video_url || resource.videoUrl) || /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/)/i.test(resource.url || '')
            const hasPdf = !!(resource.pdf_url || resource.pdfUrl) || /\.pdf(\?.*)?$/i.test(resource.url || '') || (resource.url || '').includes('drive.google.com')
            const hasLesson = !!(resource.lesson_content || resource.lessonContent)
            return (
              <article className="course-card" key={resource.id}>
                <div className="course-top">
                  <span className={`course-badge ${resource.provider_type}`}>{resource.provider_type === 'internal' ? 'Internal' : 'External'}</span>
                  <span className="course-category">{resource.category}</span>
                </div>
                <h3>{resource.title}</h3>
                <p className="course-provider"><b>{resource.provider || (resource.provider_type === 'internal' ? 'Company training' : 'External provider')}</b>{resource.duration_hours ? ` · ${resource.duration_hours}h` : ''}</p>
                <p className="course-desc">{resource.description}</p>
                {resource.objectives && <div className="course-objectives"><b>Objectives</b><ul>{resource.objectives.split(';').filter(Boolean).map((o, i) => <li key={i}>{o.trim()}</li>)}</ul></div>}
                {(resource.competencies || []).length > 0 && <div className="course-tags">{resource.competencies.map(c => <span key={c}>{c}</span>)}</div>}
                {/* Content type indicators */}
                <div className="course-content-indicators">
                  {hasLesson && <span className="ccv-indicator lesson"><BookOpen size={11} /> Lesson</span>}
                  {hasVideo && <span className="ccv-indicator video"><Play size={11} /> Video</span>}
                  {hasPdf && <span className="ccv-indicator pdf"><FileText size={11} /> PDF</span>}
                  {resource.url && !hasPdf && <a className="course-link" href={resource.url} target="_blank" rel="noreferrer">Open resource ↗</a>}
                </div>
                <div className="course-stats">
                  <span>{resource.assigned_count || 0} assigned</span>
                  <span>{resource.completed_count || 0} completed</span>
                </div>
                <div className="course-actions">
                  <button className="ccv-open-btn" type="button" onClick={() => setViewResource(resource)}>
                    <BookOpen size={13} /> View Content
                  </button>
                  {canManage && resource.is_active !== false && (
                    <>
                      <button onClick={() => editResource(resource)}>Edit</button>
                      <button className="danger" onClick={() => archive(resource)}>Archive</button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
          {!filtered.length && (
            <div className="learning-empty">
              {employee
                ? 'No recommended courses assigned yet. Your personalized courses will appear once your competency assessment and development plan are configured in Skill Development.'
                : (query || category || provType || compFilter ? 'No courses match your filters.' : 'No courses in the library yet.')
              }
            </div>
          )}
        </div>
      </section>
    )}

    {/* ================================================================= */}
    {/* RECOMMENDED FOR YOU (Department & Role Relevant + AI Development) */}
    {/* ================================================================= */}
    {tab === 'recommendations' && (
      <section className="learning-section">

        {/* Header banner */}
        <div className="completion-note" style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.06), rgba(17, 24, 39, 0.04))', borderColor: 'rgba(17,24,39,0.18)', marginBottom: 16 }}>
          <b style={{ color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} /> Gap-Based Learning Recommendations
          </b>
          <p style={{ marginTop: 4, marginBottom: 0 }}>
            Courses shown here are <b>strictly based on detected competency gaps</b> from the employee's assessment in Competency Management.
            No courses will appear until the employee has been evaluated.
          </p>
        </div>

        {/* Manager/HR Employee Selector */}
        {!employee && (
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.7)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Filter for Employee:</span>
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 220 }}
            >
              <option value="">— Select an employee —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.job_title} · {emp.department})
                </option>
              ))}
            </select>
            {recommendationsData?.relevantCompetencies?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
                <small style={{ fontSize: 10, color: '#64748b' }}>Skill Gaps Detected:</small>
                {recommendationsData.relevantCompetencies.slice(0, 4).map(c => (
                  <span key={c} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c' }}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STATE: Not assessed yet ─────────────────────────────────── */}
        {recommendationsData?.notAssessed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(248,250,252,0.8)', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(100,116,139,0.08)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
              <AlertTriangle size={24} style={{ color: '#94a3b8' }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>
              No Competency Assessment Found
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 420, margin: '0 0 16px', lineHeight: 1.6 }}>
              <b>{recommendationsData.employee?.name}</b> has not yet been evaluated in Competency Management.
              HR must first complete <b>Stage 1: Define Competency Requirements</b> in the Skill Development module to generate personalized gap-based course recommendations.
            </p>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', background: '#f3e8ff', padding: '6px 14px', borderRadius: 8 }}>
              Go to: Skill Development → Start Workflow → Define Competency Requirements
            </div>
          </div>
        )}

        {/* ── STATE: Assessed, no gaps (all on track) ─────────────────── */}
        {recommendationsData?.noGaps && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(240,253,244,0.8)', borderRadius: 14, border: '1px solid #a7f3d0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
              <CheckCircle size={24} style={{ color: '#10b981' }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#065f46', margin: '0 0 6px' }}>
              All Competencies On Track
            </h3>
            <p style={{ fontSize: 12, color: '#047857', maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
              <b>{recommendationsData.employee?.name}</b> meets or exceeds all required competency benchmarks.
              No skill-gap-based recommendations are needed at this time. Continue tracking progress in subsequent stages.
            </p>
          </div>
        )}

        {/* ── STATE: No employee selected yet (HR view only) ──────────── */}
        {!recommendationsData && !employee && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(248,250,252,0.8)', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(100,116,139,0.08)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
              <Sparkles size={24} style={{ color: '#94a3b8' }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>Select an Employee</h3>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 360, margin: 0 }}>
              Select an employee from the dropdown above to view their gap-based course recommendations.
            </p>
          </div>
        )}

        {/* ── STATE: Actual gap-matched courses ───────────────────────── */}
        {recommendationsData?.recommendedResources?.length > 0 && (
          <>
            {/* AI Plan button — only shown when there are real gaps */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button
                type="button"
                className="module-primary"
                style={{
                  background: 'linear-gradient(135deg, #111827, #111827)',
                  border: 'none',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(17,24,39,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  fontSize: 11,
                }}
                onClick={() => triggerGeneratePlan(selectedEmpId)}
                disabled={aiGeneratingPlan}
              >
                <Sparkles size={14} />
                <span>{aiGeneratingPlan ? 'AI Analyzing Skill Gaps...' : 'Generate AI Development Plan'}</span>
              </button>
            </div>

            <div className="course-grid">
              {recommendationsData.recommendedResources.map(resource => {
                const hasVideo = !!(resource.video_url || resource.videoUrl) || /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/)/i.test(resource.url || '')
                const hasPdf = !!(resource.pdf_url || resource.pdfUrl) || /\.pdf(\?.*)?$/i.test(resource.url || '') || (resource.url || '').includes('drive.google.com')
                const hasLesson = !!(resource.lesson_content || resource.lessonContent)
                return (
                  <article className="course-card" key={resource.id} style={{ borderColor: '#e5e7eb', boxShadow: '0 4px 15px rgba(17,24,39,0.05)' }}>
                    <div className="course-top">
                      <span className={`course-badge ${resource.provider_type}`}>{resource.provider_type === 'internal' ? 'Internal' : 'External'}</span>
                      {resource.is_completed || resource.assignment_status === 'completed' || Number(resource.assignment_progress) >= 100 ? (
                        <span className="course-category" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                          ✓ Resolved Gap
                        </span>
                      ) : (
                        <span className="course-category" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                          ⚠ Gap Match
                        </span>
                      )}
                    </div>
                    <h3>{resource.title}</h3>
                    <p className="course-provider"><b>{resource.provider || 'Priority Logistics Academy'}</b>{resource.duration_hours ? ` · ${resource.duration_hours}h` : ''}</p>
                    <p className="course-desc">{resource.description}</p>
                    {resource.objectives && (
                      <div className="course-objectives">
                        <b>Objectives</b>
                        <ul>{resource.objectives.split(';').filter(Boolean).map((o, i) => <li key={i}>{o.trim()}</li>)}</ul>
                      </div>
                    )}
                    <div className="course-tags">
                      {(resource.competencies || []).map(c => (
                        <span key={c} style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                    <div className="course-content-indicators">
                      {hasLesson && <span className="ccv-indicator lesson"><BookOpen size={11} /> Lesson</span>}
                      {hasVideo && <span className="ccv-indicator video"><Play size={11} /> Video</span>}
                      {hasPdf && <span className="ccv-indicator pdf"><FileText size={11} /> PDF</span>}
                      {resource.url && !hasPdf && <a className="course-link" href={resource.url} target="_blank" rel="noreferrer">Open resource ↗</a>}
                    </div>
                    <div className="course-actions" style={{ marginTop: 'auto', paddingTop: 10 }}>
                      <button className="ccv-open-btn" type="button" onClick={() => setViewResource(resource)}>
                        <BookOpen size={13} /> View Content
                      </button>
                      {resource.is_completed || resource.assignment_status === 'completed' || Number(resource.assignment_progress) >= 100 ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          <CheckCircle size={14} /> Completed
                        </span>
                      ) : resource.assignment_status ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#111827', marginLeft: 'auto' }}>
                          In Progress ({Math.round(Number(resource.assignment_progress || 0))}%)
                        </span>
                      ) : canAssign && (
                        <button
                          type="button"
                          style={{ marginLeft: 'auto', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700 }}
                          onClick={() => {
                            setAssignResource(resource)
                            if (selectedEmpId) setAssignIds([selectedEmpId])
                            setTab('assign')
                          }}
                        >
                          + Assign Module
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* No matching courses even though gaps exist */}
        {recommendationsData && !recommendationsData.notAssessed && !recommendationsData.noGaps && recommendationsData.recommendedResources?.length === 0 && (
          <div className="learning-empty">
            Gaps detected but no matching courses found in the library yet. Add relevant courses in the Course Library and tag them with the competency names.
          </div>
        )}

      </section>
    )}


    {tab === 'assign' && (
      <section className="learning-section">
        {canAssign ? <>
          <div className="assign-layout">
            <div className="assign-col">
              <h2>1 · Select a course</h2>
              <div className="assign-courses">
                {resourcesForAssign.map(r => <button key={r.id} className={`assign-course ${assignResource?.id === r.id ? 'selected' : ''}`} onClick={() => setAssignResource(r)}>
                  <b>{r.title}</b><small>{r.category}{r.provider ? ` · ${r.provider}` : ''}</small>
                </button>)}
                {!resourcesForAssign.length && <p className="learning-empty">Add courses to the library first.</p>}
              </div>
            </div>
            <div className="assign-col">
              <div className="assign-emp-header">
                <h2>2 · Select employees</h2>
                {assignIds.length > 0 && <span className="assign-count-badge">{assignIds.length} selected</span>}
              </div>
              <div className="assign-emp-search-box">
                <input
                  type="text"
                  value={empQuery}
                  onChange={e => setEmpQuery(e.target.value)}
                  placeholder="Search by name, title, dept…"
                  className="assign-emp-search-input"
                  aria-label="Search employees"
                />
                {empQuery && (
                  <button type="button" onClick={() => setEmpQuery('')} className="assign-search-clear" aria-label="Clear employee search">×</button>
                )}
              </div>
              <div className="assign-emp-actions">
                <button
                  type="button"
                  className="assign-select-all-btn"
                  onClick={() => {
                    const filteredIds = filteredEmployees.map(p => p.id)
                    const allSelected = filteredIds.length > 0 && filteredIds.every(id => assignIds.includes(id))
                    if (allSelected) {
                      setAssignIds(ids => ids.filter(id => !filteredIds.includes(id)))
                    } else {
                      setAssignIds(ids => Array.from(new Set([...ids, ...filteredIds])))
                    }
                  }}
                >
                  {filteredEmployees.length > 0 && filteredEmployees.every(p => assignIds.includes(p.id)) ? 'Deselect visible' : 'Select all visible'}
                </button>
              </div>
              <div className="assign-emp-search">
                {filteredEmployees.map(p => {
                  const isSelected = assignIds.includes(p.id)
                  return (
                    <label className={`assign-row ${isSelected ? 'selected' : ''}`} key={p.id}>
                      <span className="assign-avatar">{initials(p.full_name)}</span>
                      <div className="assign-row-info">
                        <b>{p.full_name}</b>
                        <small>{p.job_title} · {p.department}</small>
                      </div>
                      <input
                        type="checkbox"
                        className="assign-checkbox"
                        checked={isSelected}
                        onChange={() => setAssignIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])}
                        aria-label={`Select ${p.full_name}`}
                      />
                    </label>
                  )
                })}
                {!filteredEmployees.length && (
                  <p className="learning-empty">No matching employees found.</p>
                )}
              </div>
            </div>
            <div className="assign-col">
              <h2>3 · Confirm assignment</h2>
              <label>Due date (optional)<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
              <div className="assign-summary">
                <p><b>Course:</b> {assignResource ? assignResource.title : '—'}</p>
                <p><b>Employees:</b> {assignIds.length}</p>
              </div>
              <button className="module-primary" onClick={assign} disabled={!assignResource || !assignIds.length}>Assign course</button>
            </div>
          </div>
        </> : <div className="learning-empty">Only HR and supervisors can assign courses.</div>}
      </section>
    )}

    {tab === 'progress' && (
      <section className="learning-section">
        <h2 className="learning-block-title">{employee ? 'My learning assignments' : 'Learning assignments & study status'}</h2>
        {!employee && <div className="completion-note"><b>Live status badges</b><p>Each assignment shows the employee's self-reported study status (Not started / Studying / Completed / Need help) and their progress. "Need help" is highlighted so you can follow up quickly.</p></div>}
        <div className="assignment-list">
          {assignments.map(a => <article className="assignment-row" key={a.id}>
            <div className="assignment-info">
              <b>{a.resource_title}</b>
              <small>{employee ? a.category : `${a.employee_name} · ${a.department}`}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
              <div className="assignment-badges">
                <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || 'Not started'}</span>
                {a.is_completed && <span className="pill verified"><CheckCircle className="inline w-3 h-3 mr-0.5 text-emerald-500" /> Verified</span>}
                {a.fromCompetencyGap && <span className="pill gap-sourced" title="Assigned from a detected competency gap"><Target className="inline w-3 h-3 mr-0.5" /> From competency gap</span>}
              </div>
            </div>
            <div className="assignment-progress">
              <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
              <span>{a.progress || 0}%</span>
            </div>

            {/* Employee self-report controls */}
            {!a.is_completed && employee && (
              <div className="assignment-actions">
                <label className="assignment-status-select">
                  Status
                  <select value={a.status || 'not_started'} onChange={e => updateStatus(a, e.target.value)}>
                    {STUDY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="assignment-progress-input">Progress <input type="range" min="0" max="100" value={a.progress || 0} onChange={e => updateProgress(a, Number(e.target.value))} /></label>
              </div>
            )}

            {/* HR/supervisor controls */}
            {!a.is_completed && !employee && (
              <label className="assignment-progress-input">Set progress <input type="range" min="0" max="100" value={a.progress || 0} onChange={e => updateProgress(a, Number(e.target.value))} /></label>
            )}
            {!a.is_completed && canAssign && (
              <button className="module-secondary small" onClick={() => setCompleteTarget(a)}>Verify completion</button>
            )}
          </article>)}
          {!assignments.length && <div className="learning-empty">No assignments yet.</div>}
        </div>
      </section>
    )}

    {tab === 'gaps' && (() => {
      // Gap-sourced assignments: those whose course carries at least one competency tag.
      const gapAssignments = assignments.filter(a => (a.competencies || []).length > 0)
      const gapVerified = completions.filter(c =>
        gapAssignments.some(a => a.resource_id === c.resource_id && a.employee_id === c.employee_id)
      ).length
      const gapActive = gapAssignments.filter(a => !a.is_completed).length
      return (
        <section className="learning-section">
          <div className="completion-note">
            <b>Skill Gap Assignments</b>
            <p>These courses were assigned directly from detected competency skill gaps. Verifying completion here triggers a +10 pt improvement on the linked competency score.</p>
          </div>

          {/* Gap summary strip */}
          <section className="module-metrics" style={{ marginBottom: 16 }}>
            {[
              ['Gap assignments', gapAssignments.length],
              ['In progress / not started', gapActive],
              ['Verified completions', gapVerified],
            ].map(([label, val], i) => (
              <article key={label}><span>{i + 1}</span><div><small>{label}</small><b>{val}</b><em>Live value</em></div></article>
            ))}
          </section>

          <div className="assignment-list">
            {gapAssignments.map(a => (
              <article className="assignment-row" key={a.id}>
                <div className="assignment-info">
                  <b>{a.resource_title}</b>
                  <small>{employee ? '' : `${a.employee_name} · ${a.department} · `}{a.category}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
                  {/* Competency tags and status badges */}
                  <div className="assignment-badges">
                    {(a.competencies || []).map(c => (
                      <span key={c} className="pill gap-sourced" title={`Closes gap in ${c}`}><Target className="inline w-3 h-3 mr-0.5" /> {c}</span>
                    ))}
                    <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || 'Not started'}</span>
                    {a.is_completed && <span className="pill verified"><CheckCircle className="inline w-3 h-3 mr-0.5 text-emerald-500" /> Verified — competency improved</span>}
                  </div>
                </div>
                <div className="assignment-progress">
                  <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
                  <span>{a.progress || 0}%</span>
                </div>
                {!a.is_completed && canAssign && (
                  <button className="module-secondary small" onClick={() => setCompleteTarget(a)}>Verify completion</button>
                )}
              </article>
            ))}
            {!gapAssignments.length && (
              <div className="learning-empty">No skill-gap assignments yet. Assign a course from a detected gap in <b>Competency Management → Skill Gaps &amp; Learning</b>.</div>
            )}
          </div>
        </section>
      )
    })()}

    {tab === 'completions' && (
      <section className="learning-section">
        <div className="completion-note">
          <b>Verified completions only</b>
          <p>An employee is only shown as completing a course when HR or a supervisor records an official completion in the database. Self-reported "Completed" status alone does not count as verified.</p>
        </div>
        <div className="completion-list">
          {completions.map(c => <article className="completion-row" key={c.id}>
            <span className="assign-avatar">{initials(c.employee_name)}</span>
            <div><b>{c.resource_title}</b><small>{c.employee_name} · {c.department}</small></div>
            <span className="completion-date">Completed {new Date(c.completed_at).toLocaleDateString()}</span>
            {c.assessment_result && c.assessment_result.result && <span className={`pill ${c.assessment_result.result === 'Pass' ? 'complete' : 'fail'}`}>{c.assessment_result.result}</span>}
          </article>)}
          {!completions.length && <div className="learning-empty">No verified completions recorded yet.</div>}
        </div>
      </section>
    )}


    {tab === 'ai' && (
      <section className="learning-section">
        <ModuleAIInsights module="learning" stage="completed" workflowId={null} />
      </section>
    )}

    {showForm && createPortal(
      <div className="learning-modal-backdrop" role="dialog" aria-modal="true" aria-label="Course form" onClick={() => { setShowForm(false); setEditing(null) }}>
        <form onSubmit={save} className="learning-modal-dialog" onClick={event => event.stopPropagation()}>
          <div className="learning-modal-header">
            <div>
              <h2>{editing ? 'Edit course' : 'Add course to library'}</h2>
              <p>Describe the learning resource, its provider, and which competencies it supports.</p>
            </div>
            <button type="button" className="learning-modal-close-btn" onClick={() => { setShowForm(false); setEditing(null) }} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="learning-modal-body">
            <div className="learning-fields">
              <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
              <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Provider / source<input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="e.g. TESDA, Internal Training, Coursera" /></label>
              <label>Provider type<select value={form.providerType} onChange={e => setForm({ ...form, providerType: e.target.value })}>{PROV_TYPES.map(t => <option key={t} value={t}>{t === 'internal' ? 'Internal' : 'External'}</option>)}</select></label>
              <label>Duration (hours)<input type="number" min="0" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} /></label>
              <label>URL / reference<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
              <label>Video URL (YouTube / Vimeo / direct)
                <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=… or vimeo.com/…" />
              </label>
              <label>PDF attachment URL (direct link or Google Drive)
                <input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://…/module.pdf or drive.google.com/file/…" />
              </label>
              <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></label>
              <label className="full">Learning objectives<textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} placeholder="Separate objectives with semicolons (;)" /></label>
              <label className="full">
                Lesson content
                <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>Supports **bold**, *italic*, # Heading, - bullet list, {'>'} quote</span>
                <textarea
                  value={form.lessonContent}
                  onChange={e => setForm({ ...form, lessonContent: e.target.value })}
                  rows={8}
                  placeholder={"# Module Introduction\n\nWrite your lesson notes here.\n\n## Key Points\n- Point one\n- Point two\n\n**Bold text** and *italic text* supported."}
                />
              </label>
              <div className="full learning-competencies-block">
                <b>Related competencies</b>
                <div className="comp-picker">
                  {competencies.map(c => <label key={c} className={form.competencies.includes(c) ? 'selected' : ''}><input type="checkbox" checked={form.competencies.includes(c)} onChange={() => setForm(s => ({ ...s, competencies: s.competencies.includes(c) ? s.competencies.filter(x => x !== c) : [...s.competencies, c] }))} />{c}</label>)}
                  {!competencies.length && <small>No competencies available yet.</small>}
                </div>
              </div>
            </div>
          </div>
          <div className="learning-modal-footer">
            <button type="button" className="module-secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</button>
            <button type="submit" className="module-primary">{editing ? 'Save changes' : 'Add course'}</button>
          </div>
        </form>
      </div>,
      document.body
    )}

    {completeTarget && createPortal(
      <div className="learning-modal-backdrop" role="dialog" aria-modal="true" aria-label="Verify completion" onClick={() => setCompleteTarget(null)}>
        <div className="learning-modal-dialog" style={{ maxWidth: 540 }} onClick={event => event.stopPropagation()}>
          <div className="learning-modal-header">
            <div>
              <h2>Verify completion</h2>
              <p>Officially record "{completeTarget.resource_title}" as completed for {completeTarget.employee_name}.</p>
            </div>
            <button type="button" className="learning-modal-close-btn" onClick={() => setCompleteTarget(null)} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="learning-modal-body">
            <div className="learning-fields" style={{ gridTemplateColumns: '1fr' }}>
              <label>Assessment result<select value={assessmentPass} onChange={e => setAssessmentPass(e.target.value)}><option>Pass</option><option>Fail</option><option>Incomplete</option></select></label>
              <label className="full">Assessment notes<textarea value={assessmentNote} onChange={e => setAssessmentNote(e.target.value)} placeholder="Optional notes about the assessment outcome" /></label>
            </div>
          </div>
          <div className="learning-modal-footer">
            <button type="button" className="module-secondary" onClick={() => setCompleteTarget(null)}>Cancel</button>
            <button type="button" className="module-primary" onClick={recordCompletion}>Confirm verification</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Course Content Viewer modal */}
    {viewResource && (
      <CourseContentViewer resource={viewResource} onClose={() => setViewResource(null)} />
    )}

    {/* ================================================================= */}
    {/* AI SKILL-GAP DEVELOPMENT PLAN MODAL                               */}
    {/* ================================================================= */}
    {planModalOpen && aiPlan && createPortal(
      <div className="er-modal-backdrop" role="dialog" aria-modal="true" aria-label="AI Development Plan" onClick={() => setPlanModalOpen(false)}>
        <div
          className="er-dialog er-history-modal"
          style={{ width: 'min(860px, 94vw)', maxHeight: '88vh', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="er-history-header">
            <div className="er-history-user">
              <div className="er-history-avatar" style={{ background: 'linear-gradient(135deg, #111827, #111827)' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800 }}>AI Competency Development Plan</h2>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(17,24,39,0.1)', color: '#111827' }}>
                    AI Generated
                  </span>
                </div>
                <p className="er-dialog-sub">
                  Prepared for <b>{aiPlan.employeeName}</b> • {aiPlan.jobTitle} ({aiPlan.department}) • Estimated {aiPlan.timelineWeeks} Weeks Roadmap
                </p>
              </div>
            </div>
            <button className="er-history-close" onClick={() => setPlanModalOpen(false)} title="Close Plan">
              <X size={18} />
            </button>
          </div>

          {/* Plan Summary Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.06), rgba(17, 24, 39, 0.04))', border: '1px solid rgba(17,24,39,0.18)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} /> Executive Strategy Overview
            </h4>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, lineHeight: 1.5, color: '#334155' }}>
              {aiPlan.summary}
            </p>
            <p style={{ margin: 0, fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>
              {aiPlan.overview}
            </p>
          </div>

          {/* Gap-by-Gap Breakdown Cards */}
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} className="text-gray-900" />
            <span>Targeted Gap Resolution Pathways ({(aiPlan.gapPlans || []).length})</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(aiPlan.gapPlans || []).map((gp, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f3e8ff', color: '#111827', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>
                      {idx + 1}
                    </span>
                    <b style={{ fontSize: 13, color: '#0f172a' }}>{gp.competency}</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: gp.priority === 'High' ? '#fee2e2' : '#fef3c7', color: gp.priority === 'High' ? '#b91c1c' : '#b45309' }}>
                      {gp.priority} Priority
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569' }}>
                      Deficit: -{gp.gapPoints}% (Current {gp.currentScore}% → Target {gp.requiredScore}%)
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px', lineHeight: 1.45 }}>
                  <b>Role Relevance:</b> {gp.impact}
                </p>

                {/* 3-Step Action Plan */}
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Prescribed 3-Step Action Sequence:
                  </span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#1e293b', lineHeight: 1.5 }}>
                    {(gp.actionSteps || []).map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 6 }}>
                  <small style={{ fontSize: 10, color: '#64748b' }}>
                    <b>Matching Course:</b> {gp.recommendedCourse || 'Relevant Department SOP'}
                  </small>
                  <button
                    type="button"
                    style={{ background: '#111827', color: '#ffffff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => {
                      setPlanModalOpen(false)
                      setTab('library')
                    }}
                  >
                    Open in Library →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Supervisor Guidance */}
          {aiPlan.supervisorNotes && (
            <div style={{ marginTop: 16, background: '#fcfbff', border: '1px dashed #d1d5db', borderRadius: 10, padding: 12 }}>
              <b style={{ fontSize: 10.5, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Award size={13} /> Supervisor Coaching Guidance
              </b>
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#581c87', lineHeight: 1.4 }}>
                {aiPlan.supervisorNotes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="module-actions" style={{ marginTop: 18, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 12 }}>
            <button className="cancel-button" onClick={() => setPlanModalOpen(false)}>
              Close Development Plan
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </main>
}

