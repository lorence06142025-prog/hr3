import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, Check, Search, Sparkles, CheckCircle, AlertTriangle, Clock, Zap, MapPin, Calendar, Users, Lock } from 'lucide-react'
import {
  KPI_LIBRARY, LEARNING_TEMPLATES, COMPETENCY_TEMPLATES, GOAL_TEMPLATES,
  QUICK_COMMENTS, INTELLIGENT_DEFAULTS, COMPETENCY_LEVELS, LEARNING_CATEGORIES,
  REVIEW_TYPES, RECOGNITION_CATEGORIES, TRAINING_CATEGORIES, SUCCESSION_READINESS,
  getRecommendedCoursesForGap,
} from '../workflowConfig'
import { api } from '../lib/api'
import SkillRadarChart, { LEVEL_SCORES } from './SkillRadarChart'
import '../hr2Attendance.css'

// ---------------------------------------------------------------------------
// Reusable per-step business forms for the workflow engine. Each module's
// stepForms config (from workflowConfig.js) drives which fields/builders are
// rendered. Forms collect values and validate before the parent enables
// "Complete Step".
//
// UX focus: minimize typing. New field types (radiogroup, checkboxgroup,
// slider, chips, commentSuggestions) replace free-text inputs with clicks.
// Templates, searchable selectors, defaults and AI-generation dramatically
// reduce manual data entry (selection-first UX).
// ---------------------------------------------------------------------------

function CommentChips({ options, value = '', onInsert }) {
  const [used, setUsed] = useState([])
  const add = phrase => {
    if (used.includes(phrase)) return
    const next = value.trim() ? `${value.trim()}; ${phrase}` : phrase
    setUsed([...used, phrase])
    onInsert(next)
  }
  return (
    <div className="comment-chips">
      {options.map(phrase => (
        <button
          key={phrase}
          type="button"
          className={`comment-chip ${used.includes(phrase) ? 'used' : ''}`}
          onClick={() => add(phrase)}
          disabled={used.includes(phrase)}
        >
          + {phrase}
        </button>
      ))}
    </div>
  )
}

function Field({ field, value, onChange, people = [] }) {
  const set = next => onChange(field.name, next)
  switch (field.type) {
    case 'text':
      return <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} />
    case 'textarea':
      return <textarea value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} rows={field.rows || 3} />
    case 'number':
      return <input type="number" value={value ?? ''} min={field.min ?? 0} max={field.max ?? 100} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder={field.placeholder || ''} />
    case 'date':
      return <input type="date" value={value || ''} onChange={e => set(e.target.value)} />
    case 'time':
      return <input type="time" value={value || ''} onChange={e => set(e.target.value)} />
    case 'money':
      return <input type="number" value={value ?? ''} min={0} step="0.01" onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
    case 'select':
      return (
        <select value={value || ''} onChange={e => set(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )
    case 'employee':
      return (
        <select value={value || ''} onChange={e => set(e.target.value)}>
          <option value="">Select…</option>
          {field.options ? field.options.map(opt => <option key={opt} value={opt}>{opt}</option>) : people.map(p => <option key={p.id} value={p.full_name}>{p.full_name} — {p.department}</option>)}
        </select>
      )
    case 'rating':
      return (
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} type="button" className={Number(value) >= r ? 'on' : ''} onClick={() => set(r)} aria-label={`${r} star${r > 1 ? 's' : ''}`}>
              <Star size={16} fill={Number(value) >= r ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      )
    case 'toggle':
      return (
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(value)} onChange={e => set(e.target.checked)} />
          <span>{field.label || field.name}</span>
        </label>
      )
    case 'fileHint':
      return (
        <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.hint || 'Paste a link or describe the evidence'} />
      )
    case 'link':
      return <input type="url" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || 'https://…'} />
    case 'radiogroup':
      return (
        <div className="choice-group">
          {(field.options || []).map(opt => (
            <label key={opt} className={value === opt ? 'selected' : ''}>
              <input type="radio" name={field.name} checked={value === opt} onChange={() => set(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )
    case 'checkboxgroup':
      return (
        <div className="choice-group">
          {(field.options || []).map(opt => {
            const arr = Array.isArray(value) ? value : []
            const checked = arr.includes(opt)
            return (
              <label key={opt} className={checked ? 'selected' : ''}>
                <input type="checkbox" checked={checked} onChange={() => set(checked ? arr.filter(x => x !== opt) : [...arr, opt])} />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )
    case 'slider':
      return (
        <div className="slider-field">
          <input type="range" min={field.min ?? 0} max={field.max ?? 100} value={Number(value ?? 0)} onChange={e => set(Number(e.target.value))} />
          <b>{Number(value ?? 0)}%</b>
        </div>
      )
    case 'chips':
      return (
        <div className="choice-group chips-group">
          {(field.options || []).map(opt => {
            const arr = Array.isArray(value) ? value : []
            const selected = arr.includes(opt)
            return (
              <button key={opt} type="button" className={`chip ${selected ? 'selected' : ''}`} onClick={() => set(selected ? arr.filter(x => x !== opt) : [...arr, opt])}>
                {selected ? <Check size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <span style={{ marginRight: 3 }}>+</span>}{opt}
              </button>
            )
          })}
        </div>
      )
    case 'commentSuggestions':
      return <CommentChips options={field.options || []} value={value || ''} onInsert={set} />
    case 'template':
      return <TemplateSelect field={field} value={value || ''} onChange={set} />
    case 'aiGenerate':
      return <AIGenerateButton field={field} value={value || ''} onChange={set} />
    default:
      return <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} />
  }
}

// ------------------------ Selection-first helpers ---------------------------

// Generic searchable template/option picker. Clicking an option sets the value
// and, via onApply, auto-fills dependent fields (title, description, etc.).
function TemplateSelect({ field, value, onChange }) {
  const [query, setQuery] = useState('')
  const options = field.library || field.options || []
  const filtered = options.filter(o => String(o.title || o.name || o).toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="template-select">
      <div className="template-search">
        <span className="template-search-icon"><Search size={14} /></span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={field.placeholder || 'Search templates…'} />
      </div>
      <div className="template-list">
        {filtered.map(o => {
          const label = o.title || o.name || (typeof o === 'string' ? o : '')
          const sub = o.category || o.description || ''
          return (
            <button key={label} type="button" className={`template-option ${value === label ? 'selected' : ''}`} onClick={() => { onChange(label); field.onApply?.(o) }}>
              <span className="template-option-label">{label}</span>
              {sub && <small className="template-option-sub">{sub}</small>}
            </button>
          )
        })}
        {filtered.length === 0 && <p className="template-empty">No templates found.</p>}
      </div>
    </div>
  )
}

// "Generate using AI" button that fills a textarea with a generated draft.
function AIGenerateButton({ field, value, onChange }) {
  const [busy, setBusy] = useState(false)
  const generate = async () => {
    setBusy(true)
    // Local, deterministic draft generator (no backend call) so the button
    // always works offline and never blocks completion.
    const seed = field.seed || field.label || field.name || 'this item'
    const draft = `Generated ${seed.toLowerCase()}: a clear, professional draft based on the selected context. Review and refine if needed.`
    setTimeout(() => { onChange(draft); setBusy(false) }, 400)
  }
  return (
    <div className="ai-generate-row">
      <button type="button" className="ai-generate-btn" onClick={generate} disabled={busy}>
        {busy ? 'Generating…' : <><Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Generate using AI</>}
      </button>
      {value && <span className="ai-generate-hint">Draft generated — edit if needed.</span>}
    </div>
  )
}

// ------------------------- Builder: KPI table ------------------------------

function KpiBuilder({ value = [], onChange }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { name: '', weight: 25, description: '', target: '90%' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))

  const autoDistribute = () => {
    if (!value.length) return
    const count = value.length
    const base = Math.floor(100 / count)
    const remainder = 100 - (base * count)
    const updated = value.map((kpi, index) => ({
      ...kpi,
      weight: index < remainder ? base + 1 : base,
      target: kpi.target || '90%'
    }))
    onChange(updated)
  }

  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const isWeightValid = Math.abs(totalWeight - 100) <= 0.5

  return (
    <div className="builder kpi-builder">
      <div className="builder-top-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className={`weight-total ${isWeightValid ? 'ok' : 'error'}`} style={{ fontSize: 12, fontWeight: 700 }}>
          {isWeightValid ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Total Weight: 100%</> : `Total Weight: ${totalWeight}% (Must be 100%)`}
        </span>
        {value.length > 0 && (
          <button type="button" className="btn-auto-distribute" onClick={autoDistribute} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #c7d2fe', background: '#f3f4f6', color: '#111827', cursor: 'pointer' }}>
            <Sparkles size={12} /> Auto-Distribute 100% Evenly
          </button>
        )}
      </div>
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>KPI name<input value={row.name} onChange={e => set(index, { name: e.target.value })} placeholder="e.g. Guest satisfaction" /></label>
            <label>Weight %<input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value === '' ? '' : Number(e.target.value) })} min={0} max={100} /></label>
            <label>Target value<input value={row.target} onChange={e => set(index, { target: e.target.value })} placeholder="e.g. 90%" /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete KPI">×</button>
          </div>
          <label>Description<textarea value={row.description} onChange={e => set(index, { description: e.target.value })} rows={2} placeholder="Describe what this KPI measures" /></label>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Add KPI</button>
    </div>
  )
}

function KpiLibraryBuilder({ value = [], onChange }) {
  const add = kpi => {
    if (!kpi || value.some(r => r.name === kpi.name)) return
    const count = value.length + 1
    const baseWeight = Math.floor(100 / count)
    const newKpis = [...value, { 
      name: kpi.name, 
      weight: baseWeight || 25, 
      description: kpi.description, 
      target: kpi.target || '90%', 
      measurement: kpi.measurement 
    }]
    onChange(newKpis)
  }

  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const remove = index => onChange(value.filter((_, i) => i !== index))

  const autoDistribute = () => {
    if (!value.length) return
    const count = value.length
    const base = Math.floor(100 / count)
    const remainder = 100 - (base * count)
    const updated = value.map((kpi, index) => ({
      ...kpi,
      weight: index < remainder ? base + 1 : base,
      target: kpi.target || '90%'
    }))
    onChange(updated)
  }

  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const isWeightValid = Math.abs(totalWeight - 100) <= 0.5

  return (
    <div className="builder competency-template-builder">
      <div className="kpi-picker-field">
        <label className="competency-picker-label">
          <span>Select a KPI to add</span>
          <select value="" onChange={e => {
            const kpi = KPI_LIBRARY.find(k => k.name === e.target.value)
            add(kpi)
            e.target.value = ''
          }}>
            <option value="">Choose a KPI…</option>
            {['All', 'Food & Beverage', 'Kitchen', 'Housekeeping', 'Front Office'].map(dept => {
              const deptKpis = KPI_LIBRARY.filter(k => (k.department || 'All') === dept)
              if (!deptKpis.length) return null
              return (
                <optgroup key={dept} label={dept === 'All' ? 'General (All Departments)' : dept}>
                  {deptKpis.map(k => (
                    <option key={k.name} value={k.name} disabled={value.some(r => r.name === k.name)}>
                      {k.name} · {k.measurement}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <small>Pick a KPI from the list (grouped by department) to add it, then adjust its weight and target if needed.</small>
        </label>
      </div>
      {value.length > 0 && (
        <div className="competency-loaded">
          <div className="competency-loaded-head">
            <div>
              <b>Configured KPIs ({value.length})</b>
              <small>Total weight must equal 100% to proceed</small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button 
                type="button" 
                className="btn-auto-distribute" 
                onClick={autoDistribute}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #c7d2fe', background: '#f3f4f6', color: '#111827', cursor: 'pointer' }}
              >
                <Sparkles size={12} /> Auto-Distribute 100% Evenly
              </button>
              <span className={`weight-total ${isWeightValid ? 'ok' : 'error'}`}>
                {isWeightValid ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Total 100%</> : `Total ${totalWeight}% (Must be 100%)`}
              </span>
            </div>
          </div>
          <div className="competency-table">
            {value.map((row, index) => (
              <div className="competency-table-row" key={index}>
                <div className="competency-table-name">
                  <label><small>KPI Name</small>
                    <input value={row.name} onChange={e => set(index, { name: e.target.value })} placeholder="KPI name" />
                  </label>
                </div>
                <div className="kpi-table-target">
                  <label><small>Target Score</small>
                    <input value={row.target || '90%'} onChange={e => set(index, { target: e.target.value })} placeholder="e.g. 90%" />
                  </label>
                </div>
                <div className="competency-table-weight">
                  <label><small>Weight (%)</small>
                    <input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value === '' ? '' : Number(e.target.value) })} min={0} max={100} />
                  </label>
                  <i className="weight-bar"><em style={{ width: `${Math.min(100, Number(row.weight) || 0)}%` }} /></i>
                </div>
                <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Remove KPI">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------- Builder: Hotel & Restaurant Evaluation -----------------------------

export const DEPARTMENT_EVALUATION_CRITERIA = {
  'Food & Beverage': [
    { id: 'fb_1', name: 'Order Accuracy & Table Service', description: 'Accuracy in taking food/beverage orders, correct dish delivery, and sequence of table service.', weight: 10 },
    { id: 'fb_2', name: 'Menu & Beverage Knowledge', description: 'Deep understanding of menu ingredients, allergen awareness, daily specials, and beverage pairings.', weight: 10 },
    { id: 'fb_3', name: 'Punctuality & Shift Readiness', description: 'Reliability in reporting on time, uniform grooming standards, and station readiness before service.', weight: 10 },
    { id: 'fb_4', name: 'Food Safety, Sanitation & Hygiene', description: 'Strict compliance with food safety protocols, table sanitization, clean glassware, and hygiene rules.', weight: 10 },
    { id: 'fb_5', name: 'Customer Service & Guest Hospitality', description: 'Warm greeting, attentive table maintenance, courteous communication, and guest satisfaction.', weight: 10 },
    { id: 'fb_6', name: 'Kitchen & Service Communication', description: 'Clear communication with culinary kitchen line, POS system proficiency, and fast order transmission.', weight: 10 },
    { id: 'fb_7', name: 'Teamwork & Cross-Section Support', description: 'Supporting fellow servers, busing tables during rushes, and cooperating across F&B sections.', weight: 10 },
    { id: 'fb_8', name: 'Availability & Peak Hour Flexibility', description: 'Willingness to support during high-volume dinner rushes, banquet events, and shift extensions.', weight: 5 },
    { id: 'fb_9', name: 'Station Prep & Independence', description: 'Self-sufficient side station restocking, cutlery polishing, and working with minimal intervention.', weight: 5 },
    { id: 'fb_10', name: 'Initiative & Proactive Service', description: 'Anticipating guest water refills, clearing finished plates promptly, and identifying service gaps.', weight: 5 },
    { id: 'fb_11', name: 'Service Recovery & Complaint Handling', description: 'Calm resolution of customer food complaints, billing queries, and graceful dispute management.', weight: 5 },
    { id: 'fb_12', name: 'Composure Under Dining Rush', description: 'Maintaining emotional composure, steady pacing, and courteous demeanor during heavy covers.', weight: 5 },
    { id: 'fb_13', name: 'Shift Leadership & Mentorship', description: 'Guiding apprentice waitstaff, station handover quality, and promoting team harmony.', weight: 2.5 },
    { id: 'fb_14', name: 'Suggestive Selling & Upselling', description: 'Effective promotion of appetizers, premium wine pairings, desserts, and tasting specials.', weight: 2.5 },
  ],

  'Kitchen': [
    { id: 'kit_1', name: 'Food Quality & Recipe Consistency', description: 'Precision in taste, portioning, cooking temperatures, and presentation according to standard recipes.', weight: 10 },
    { id: 'kit_2', name: 'Culinary Knowledge & Knife Skills', description: 'Mastery of knife techniques, cooking methods, butchery, sauces, and culinary workstation tools.', weight: 10 },
    { id: 'kit_3', name: 'Punctuality & Shift Attendance', description: 'Dependability on reporting on time for kitchen prep shifts, line stations, and banquet setups.', weight: 10 },
    { id: 'kit_4', name: 'Food Safety, Hygiene & HACCP', description: 'Strict compliance with temperature logs, cross-contamination prevention, dating/labeling, and sanitizing.', weight: 10 },
    { id: 'kit_5', name: 'Ticket Timing & Speed of Execution', description: 'Consistent ticket turnaround times, synchronized plating with waitstaff, and line speed.', weight: 10 },
    { id: 'kit_6', name: 'Line Calling & Station Communication', description: 'Clear auditory communication with the Head Chef, Sous Chef, expediter, and fellow line cooks.', weight: 10 },
    { id: 'kit_7', name: 'Kitchen Teamwork & Line Support', description: 'Assisting adjacent stations during heavy dockets, backing up dishwashing, and team collaboration.', weight: 10 },
    { id: 'kit_8', name: 'Availability & Banquet Flexibility', description: 'Willingness to take on early prep shifts, late cleanups, and banquet event catering production.', weight: 5 },
    { id: 'kit_9', name: 'Mise en Place & Station Independence', description: 'Organized, independent station setup with all ingredients prepped and stocked prior to rush.', weight: 5 },
    { id: 'kit_10', name: 'Portion Control & Waste Reduction', description: 'Minimizing ingredient trim waste, proper storage of leftovers, and respecting food cost targets.', weight: 5 },
    { id: 'kit_11', name: 'Special Dietary & Allergen Handling', description: 'Careful execution of gluten-free, vegan, and severe allergy dockets without cross-contact.', weight: 5 },
    { id: 'kit_12', name: 'Peak Rush Composure & Stamina', description: 'Maintaining focus, precision, and a calm professional attitude in a hot, high-pressure kitchen.', weight: 5 },
    { id: 'kit_13', name: 'Station Leadership & Mentorship', description: 'Mentoring commis chefs/apprentices, maintaining station equipment, and cleanliness leadership.', weight: 2.5 },
    { id: 'kit_14', name: 'Creative Contribution & Efficiency', description: 'Suggesting prep improvements, daily special ideas, and creative kitchen process optimizations.', weight: 2.5 },
  ],

  'Housekeeping': [
    { id: 'hk_1', name: 'Room Cleaning & Sanitization Standards', description: 'Thoroughness in dusting, vacuuming, bed making, bathroom disinfection, and immaculate cleanliness.', weight: 10 },
    { id: 'hk_2', name: 'Cleaning SOPs & Chemical Knowledge', description: 'Correct usage of housekeeping chemicals, PPE, cleaning machinery, and color-coded cloths.', weight: 10 },
    { id: 'hk_3', name: 'Shift Punctuality & Attendance', description: 'Timely morning briefing attendance, prompt start on floor assignments, and shift dependability.', weight: 10 },
    { id: 'hk_4', name: 'Room Turnaround Time & Productivity', description: 'Meeting daily room inspection quotas (stayover and checkout turnarounds) within allotted time.', weight: 10 },
    { id: 'hk_5', name: 'Guest Courtesy & Privacy Protocol', description: 'Polite guest greetings, respecting "Do Not Disturb" signs, and upholding guest privacy and security.', weight: 10 },
    { id: 'hk_6', name: 'Radio & Discrepancy Communication', description: 'Prompt status updates to Front Office via radio/PMS when rooms are clean, inspected, or out of order.', weight: 10 },
    { id: 'hk_7', name: 'Teamwork & Linen Room Collaboration', description: 'Cooperating with laundry attendants, housemen, and floor partners during high-occupancy days.', weight: 10 },
    { id: 'hk_8', name: 'Peak Occupancy & Weekend Flexibility', description: 'Availability to work during hotel peak seasons, weekend turnovers, and holiday shifts.', weight: 5 },
    { id: 'hk_9', name: 'Trolley Organization & Autonomy', description: 'Keeping housekeeping carts neatly stocked, organized, and working independently with minimal oversight.', weight: 5 },
    { id: 'hk_10', name: 'Defect Reporting & Preventive Care', description: 'Proactively identifying and reporting maintenance issues (leaks, blown bulbs, carpet stains).', weight: 5 },
    { id: 'hk_11', name: 'Lost & Found Compliance', description: 'Immediate, accurate logging and handover of guest forgotten items according to hotel security SOPs.', weight: 5 },
    { id: 'hk_12', name: 'Composure During Mass Turnovers', description: 'Maintaining rigorous quality standards and calm focus during heavy back-to-back check-in rushes.', weight: 5 },
    { id: 'hk_13', name: 'Floor Inspection Leadership', description: 'Assisting supervisors with spot checks, training new room attendants, and VIP room setups.', weight: 2.5 },
    { id: 'hk_14', name: 'Amenities Conservation & Asset Care', description: 'Preventing linen damage, controlled usage of guest amenities, and reducing laundry chemical waste.', weight: 2.5 },
  ],

  'Front Office': [
    { id: 'fo_1', name: 'Check-in & Check-out Speed & Precision', description: 'Flawless execution of check-in/out procedures, key card issuance, and guest identity verification.', weight: 10 },
    { id: 'fo_2', name: 'PMS System & Hotel SOP Knowledge', description: 'Proficiency in Property Management Systems (Opera/Cloud PMS), room rates, and hotel policies.', weight: 10 },
    { id: 'fo_3', name: 'Shift Punctuality & Handover Reliability', description: 'Reliability in reporting for shift briefings, cash float counting, and detailed shift handover notes.', weight: 10 },
    { id: 'fo_4', name: 'Billing, Payment & Cash Handling Accuracy', description: 'Zero discrepancies in guest folios, credit card processing, currency exchange, and ledger audits.', weight: 10 },
    { id: 'fo_5', name: 'Warm Hospitality & Guest Welcoming', description: 'First impression excellence, genuine hospitality demeanor, eye contact, and professional grooming.', weight: 10 },
    { id: 'fo_6', name: 'Telephone & Concierge Etiquette', description: 'Professional phone manner within 3 rings, accurate local recommendations, and message delivery.', weight: 10 },
    { id: 'fo_7', name: 'Cross-Departmental Coordination', description: 'Seamless coordination with Housekeeping (room readiness), Bell desk, and Maintenance teams.', weight: 10 },
    { id: 'fo_8', name: 'Night Shift & Peak Hour Availability', description: 'Flexibility to cover night audit shifts, early departures, and large group arrival surges.', weight: 5 },
    { id: 'fo_9', name: 'Lobby Presence & Front Desk Autonomy', description: 'Independent lobby management, proactive queue management, and self-sufficient problem handling.', weight: 5 },
    { id: 'fo_10', name: 'VIP & Loyalty Guest Recognition', description: 'Accurate recognition of frequent guests, loyalty program perks, and personalized welcome amenities.', weight: 5 },
    { id: 'fo_11', name: 'Service Recovery & De-escalation', description: 'Effective handling of guest complaints, room change requests, and resolving billing disputes calmly.', weight: 5 },
    { id: 'fo_12', name: 'Composure Under High-Volume Check-ins', description: 'Remaining calm, poised, and courteous when managing long queues during major flight/tour arrivals.', weight: 5 },
    { id: 'fo_13', name: 'Shift Leadership & Duty Handover', description: 'Leading desk operations during supervisor absence, mentoring trainees, and audit integrity.', weight: 2.5 },
    { id: 'fo_14', name: 'Room Upselling & Revenue Enhancement', description: 'Active promotion of suite upgrades, late checkouts, breakfast packages, and spa bookings.', weight: 2.5 },
  ],

  'Engineering': [
    { id: 'eng_1', name: 'Preventive Maintenance Quality', description: 'Execution of scheduled preventive maintenance tasks across HVAC, plumbing, boilers, and plant rooms.', weight: 10 },
    { id: 'eng_2', name: 'Technical & Systems Knowledge', description: 'Comprehensive understanding of electrical circuits, HVAC chillers, pumps, BMS, and guestroom fixtures.', weight: 10 },
    { id: 'eng_3', name: 'Emergency Response & Punctuality', description: 'Fast response times to emergency engineering calls, shift timeliness, and on-call readiness.', weight: 10 },
    { id: 'eng_4', name: 'OSHA, Safety & Fire Code Compliance', description: 'Strict adherence to lockout/tagout (LOTO), fire alarm testing, safety PPE, and chemical handling.', weight: 10 },
    { id: 'eng_5', name: 'Guestroom Work Order Resolution Speed', description: 'Prompt and discreet resolution of in-room guest maintenance requests (AC, TV, plumbing, safe).', weight: 10 },
    { id: 'eng_6', name: 'Technical Log & Inter-dept Communication', description: 'Accurate work order logging in engineering software and clear updates to Front Desk/Housekeeping.', weight: 10 },
    { id: 'eng_7', name: 'Teamwork & Multi-Craft Collaboration', description: 'Collaborating across electrical, carpentry, painting, and mechanical maintenance projects.', weight: 10 },
    { id: 'eng_8', name: 'Emergency & Weekend Availability', description: 'Willingness to report for urgent night breakdowns, storm preparedness, and holiday coverage.', weight: 5 },
    { id: 'eng_9', name: 'Independent Troubleshooting', description: 'Ability to diagnose complex technical faults and execute repairs with minimal guidance.', weight: 5 },
    { id: 'eng_10', name: 'Energy Management & Sustainability', description: 'Monitoring energy consumption, identifying utility leaks, and supporting green hotel initiatives.', weight: 5 },
    { id: 'eng_11', name: 'Root Cause Repair & Recurrence Prevention', description: 'Solving underlying mechanical/electrical issues rather than applying temporary surface fixes.', weight: 5 },
    { id: 'eng_12', name: 'Composure During Critical Outages', description: 'Calm and methodical execution during power outages, elevator stoppages, or water line failures.', weight: 5 },
    { id: 'eng_13', name: 'Workshop Leadership & Tool Ownership', description: 'Maintaining organized workshop tools, machinery maintenance, and mentoring junior technicians.', weight: 2.5 },
    { id: 'eng_14', name: 'Spare Parts Inventory & Cost Efficiency', description: 'Accurate tracking of replacement parts, vendor coordination, and minimizing repair expenses.', weight: 2.5 },
  ],

  'Human Resources': [
    { id: 'hr_1', name: 'HR Operations & Filing Accuracy', description: 'Precision in 201 filing, contract preparation, government compliance, and HR records management.', weight: 10 },
    { id: 'hr_2', name: 'Labor Law & Hotel Policy Knowledge', description: 'Solid understanding of labor codes, company code of discipline, benefits, and standard procedures.', weight: 10 },
    { id: 'hr_3', name: 'Punctuality & HR Desk Reliability', description: 'Dependability in attending HR meetings, keeping office hours, and prompt attendance tracking.', weight: 10 },
    { id: 'hr_4', name: 'Confidentiality & Data Privacy Compliance', description: 'Strict protection of employee personal data, medical records, compensation, and disciplinary files.', weight: 10 },
    { id: 'hr_5', name: 'Employee Relations & Service Mindset', description: 'Approachable, empathetic, and professional support for employee inquiries, benefits, and welfare.', weight: 10 },
    { id: 'hr_6', name: 'Clear Communication & Advisory Skills', description: 'Effective written memos, employee briefings, and clear communication with department managers.', weight: 10 },
    { id: 'hr_7', name: 'Collaboration with Department Heads', description: 'Proactive partnership with hotel line managers on staffing needs, performance reviews, and training.', weight: 10 },
    { id: 'hr_8', name: 'Event & Recruitment Drive Availability', description: 'Flexibility to support job fairs, mass hiring, town halls, and employee recognition events.', weight: 5 },
    { id: 'hr_9', name: 'Case Management & Task Autonomy', description: 'Managing onboarding, exit clearances, and employee claims independently without constant direction.', weight: 5 },
    { id: 'hr_10', name: 'Employee Engagement & Wellness Initiative', description: 'Proactive organization of team-building activities, health programs, and employee engagement programs.', weight: 5 },
    { id: 'hr_11', name: 'Grievance Handling & Conflict Mediation', description: 'Fair, unbiased facilitation of employee conflicts and smooth resolution of workplace grievances.', weight: 5 },
    { id: 'hr_12', name: 'Composure During Sensitive Situations', description: 'Maintaining professional composure, objectivity, and discretion during disciplinary investigations.', weight: 5 },
    { id: 'hr_13', name: 'HR Project Leadership & Mentorship', description: 'Leading HR initiatives (e.g. system digitization, policy updates) and mentoring junior HR staff.', weight: 2.5 },
    { id: 'hr_14', name: 'Talent Retention & Sourcing Efficiency', description: 'Optimizing recruitment turnaround times, reducing recruitment costs, and improving staff retention.', weight: 2.5 },
  ],

  'Security': [
    { id: 'sec_1', name: 'Patrol Thoroughness & Vigilance', description: 'Rigorous inspection of hotel perimeters, emergency exits, guest corridors, and back-of-house areas.', weight: 10 },
    { id: 'sec_2', name: 'Security SOPs & Emergency Protocol Knowledge', description: 'Mastery of emergency response protocols (fire, medical, bomb threat, evacuation, trespasser).', weight: 10 },
    { id: 'sec_3', name: 'Punctuality & Guard Post Reliability', description: 'Punctual attendance at post handovers, alert post posture, and dependable shift attendance.', weight: 10 },
    { id: 'sec_4', name: 'CCTV Monitoring & Incident Log Accuracy', description: 'Meticulous logging of security incidents, visitor logs, key issuance, and active CCTV surveillance.', weight: 10 },
    { id: 'sec_5', name: 'Courteous & Firm Guest/Visitor Interaction', description: 'Balancing approachable hospitality with firm security enforcement at hotel entry points.', weight: 10 },
    { id: 'sec_6', name: 'Radio Etiquette & Incident Reporting', description: 'Crisp, professional two-way radio protocol and detailed, factual incident documentation.', weight: 10 },
    { id: 'sec_7', name: 'Teamwork with Duty Managers & Night Staff', description: 'Seamless cooperation with Night Managers, Front Desk, and Engineering during night shifts.', weight: 10 },
    { id: 'sec_8', name: 'VIP Event & Night Shift Availability', description: 'Willingness to cover high-security VIP banquets, night duty, and emergency standby.', weight: 5 },
    { id: 'sec_9', name: 'Guard Post Autonomy & Situational Awareness', description: 'Self-sufficient management of access control points, bag checks, and vehicle screening.', weight: 5 },
    { id: 'sec_10', name: 'Proactive Hazard Identification', description: 'Early detection of fire hazards, blocked stairwells, suspicious items, and safety risks.', weight: 5 },
    { id: 'sec_11', name: 'De-escalation & Conflict Management', description: 'Defusing intoxicated guests or aggressive individuals peacefully without escalating disruption.', weight: 5 },
    { id: 'sec_12', name: 'Composure Under Crisis & Emergencies', description: 'Poise, rapid decision-making, and disciplined execution during medical or safety emergencies.', weight: 5 },
    { id: 'sec_13', name: 'Security Post Leadership & Inspection', description: 'Conducting guard briefings, drill inspections, and mentoring newly deployed security personnel.', weight: 2.5 },
    { id: 'sec_14', name: 'Loss Prevention & Asset Protection', description: 'Preventing pilferage of hotel property, vendor delivery audits, and contractor compliance.', weight: 2.5 },
  ],

  'Sales & Marketing': [
    { id: 'sm_1', name: 'Revenue & Sales Target Achievement', description: 'Performance against monthly room nights, banquet revenue, and corporate sales volume targets.', weight: 10 },
    { id: 'sm_2', name: 'Product, Rate & Banquet Knowledge', description: 'Expertise in room categories, meeting package pricing, F&B banquet menus, and seasonal rate structures.', weight: 10 },
    { id: 'sm_3', name: 'Client Meeting & Proposal Punctuality', description: 'Reliability in meeting clients, prompt delivery of contracts/proposals, and follow-up timeliness.', weight: 10 },
    { id: 'sm_4', name: 'Contracting & Revenue Policy Compliance', description: 'Strict compliance with hotel credit policies, deposit requirements, cancellation terms, and contracts.', weight: 10 },
    { id: 'sm_5', name: 'Client Relationship Management & Hospitality', description: 'Building high-trust, long-term relationships with corporate bookers, event planners, and travel agents.', weight: 10 },
    { id: 'sm_6', name: 'Inter-departmental Banquet Coordination', description: 'Clear Event Order (BEO) handovers to F&B, Kitchen, and Front Desk to ensure flawless event execution.', weight: 10 },
    { id: 'sm_7', name: 'Sales Team Collaboration & Cross-Selling', description: 'Working constructively with peers on large bids, joint site inspections, and cross-segment leads.', weight: 10 },
    { id: 'sm_8', name: 'Event Coverage & Client Entertaining Availability', description: 'Flexibility to attend evening networking events, weekend site inspections, and client dinners.', weight: 5 },
    { id: 'sm_9', name: 'Lead Pipeline Management & Autonomy', description: 'Self-driven prospecting, CRM pipeline updating, lead qualification, and account management.', weight: 5 },
    { id: 'sm_10', name: 'Market Intelligence & Competitor Tracking', description: 'Proactively gathering competitor pricing insights, market trends, and new business opportunities.', weight: 5 },
    { id: 'sm_11', name: 'Negotiation & Contract Closing', description: 'Overcoming client objections, commercial win-win negotiations, and closing event contracts.', weight: 5 },
    { id: 'sm_12', name: 'Composure Under Tight Pitch Deadlines', description: 'Maintaining high proposal quality and positive attitude when preparing urgent, high-value bids.', weight: 5 },
    { id: 'sm_13', name: 'Account Strategy Leadership & Mentorship', description: 'Developing key account growth strategies, mentoring sales coordinators, and pitch leadership.', weight: 2.5 },
    { id: 'sm_14', name: 'Package Upselling & High-Margin Booking', description: 'Upselling premium banquet beverage packages, audio-visual enhancements, and multi-day bookings.', weight: 2.5 },
  ],

  'Finance': [
    { id: 'fin_1', name: 'Accounting Precision & Reconciliation', description: 'Zero error tolerance in ledger entries, bank reconciliations, tax filings, and balance sheet accounts.', weight: 10 },
    { id: 'fin_2', name: 'USALI & Hospitality Accounting Knowledge', description: 'Mastery of Uniform System of Accounts for the Lodging Industry (USALI), revenue audits, and tax laws.', weight: 10 },
    { id: 'fin_3', name: 'Deadline Reliability & Punctuality', description: 'Consistent on-time delivery of daily income audits, payroll runs, vendor payments, and month-end closes.', weight: 10 },
    { id: 'fin_4', name: 'Internal Controls & Audit Compliance', description: 'Rigorous enforcement of purchasing authorization, petty cash audits, and anti-fraud protocols.', weight: 10 },
    { id: 'fin_5', name: 'Internal Customer Service & Support', description: 'Prompt and courteous support to department managers regarding budget queries, invoices, and payroll.', weight: 10 },
    { id: 'fin_6', name: 'Financial Reporting & Communication', description: 'Clear presentation of financial variances, departmental P&L statements, and cash flow reports.', weight: 10 },
    { id: 'fin_7', name: 'Audit Team Collaboration', description: 'Constructive teamwork within the finance office and smooth cooperation with external auditors.', weight: 10 },
    { id: 'fin_8', name: 'Month-End & Year-End Close Availability', description: 'Flexibility to commit additional hours during fiscal closes, physical inventory counts, and audits.', weight: 5 },
    { id: 'fin_9', name: 'Reconciliation Autonomy & Workflow', description: 'Independent resolution of ledger clearing accounts, credit card settlements, and supplier statements.', weight: 5 },
    { id: 'fin_10', name: 'Cost Leakage Identification & Initiative', description: 'Proactive detection of billing leakages, supplier overcharges, and operational cost savings.', weight: 5 },
    { id: 'fin_11', name: 'Variance Analysis & Dispute Resolution', description: 'Investigating department cost variances and resolving complex billing disputes with corporate accounts.', weight: 5 },
    { id: 'fin_12', name: 'Composure During Strict Fiscal Deadlines', description: 'Maintaining accuracy, precision, and focus under tight month-end reporting schedules.', weight: 5 },
    { id: 'fin_13', name: 'Financial Systems & Audit Leadership', description: 'Assisting in financial system upgrades, policy implementation, and training junior accountants.', weight: 2.5 },
    { id: 'fin_14', name: 'Budget Optimization & Cost Enforcement', description: 'Guiding department heads in optimizing OPEX budgets, renegotiating supplier terms, and efficiency.', weight: 2.5 },
  ]
}

export function getDepartmentCriteria(departmentName) {
  if (!departmentName) return DEPARTMENT_EVALUATION_CRITERIA['Food & Beverage']
  const dept = String(departmentName).toLowerCase()
  if (dept.includes('kitchen') || dept.includes('culinary') || dept.includes('cook') || dept.includes('chef')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Kitchen']
  }
  if (dept.includes('food') || dept.includes('beverage') || dept.includes('f&b') || dept.includes('restaurant') || dept.includes('bar') || dept.includes('dining')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Food & Beverage']
  }
  if (dept.includes('housekeeping') || dept.includes('laundry') || dept.includes('clean')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Housekeeping']
  }
  if (dept.includes('front') || dept.includes('reception') || dept.includes('concierge') || dept.includes('lobby')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Front Office']
  }
  if (dept.includes('engineer') || dept.includes('maintenance') || dept.includes('facility')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Engineering']
  }
  if (dept.includes('human') || dept.includes('hr') || dept.includes('personnel')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Human Resources']
  }
  if (dept.includes('security') || dept.includes('safety') || dept.includes('guard')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Security']
  }
  if (dept.includes('sales') || dept.includes('market')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Sales & Marketing']
  }
  if (dept.includes('finance') || dept.includes('account') || dept.includes('audit')) {
    return DEPARTMENT_EVALUATION_CRITERIA['Finance']
  }
  return DEPARTMENT_EVALUATION_CRITERIA['Food & Beverage']
}

export const HOSPITALITY_EVALUATION_CRITERIA = DEPARTMENT_EVALUATION_CRITERIA['Food & Beverage']

const RATING_SCALE_LEGEND = [
  { rating: 1, label: 'Poor', desc: 'Unsatisfactory / Needs critical improvement' },
  { rating: 2, label: 'Fair', desc: 'Inconsistent / Below standard' },
  { rating: 3, label: 'Satisfactory', desc: 'Meets core hospitality standards' },
  { rating: 4, label: 'Good', desc: 'Exceeds standards / Highly reliable' },
  { rating: 5, label: 'Excellent', desc: 'Outstanding role model' },
]

function calculateWeightedKpiAverage(kpis = []) {
  const rows = (kpis || [])
    .map(kpi => ({
      score: Number(kpi?.score ?? (Number(kpi?.rating || 0) * 20)),
      weight: Number(kpi?.weight) || (100 / (kpis.length || 14)),
      target: kpi?.target
    }))
    .filter(kpi => Number.isFinite(kpi.score))
  if (!rows.length) return 0
  const totalWeight = rows.reduce((sum, kpi) => sum + (kpi.weight > 0 ? kpi.weight : 0), 0)
  if (totalWeight > 0) {
    const totalWeightedScore = rows.reduce((sum, kpi) => {
      const achievement = kpi.score / 100
      return sum + (achievement * kpi.weight)
    }, 0)
    const normalized = (totalWeightedScore / totalWeight) * 100
    return Math.min(100, Math.max(0, Math.round(normalized * 10) / 10))
  }
  return Math.round((rows.reduce((sum, kpi) => sum + kpi.score, 0) / rows.length) * 10) / 10
}

function extractKpiData(events, stageKey) {
  // Search all events for the stage — prefer the most recent one with kpiRatings
  const matchingEvents = (events || []).filter(ev => ev.stage === stageKey && ev.details)
  
  for (const event of [...matchingEvents].reverse()) {
    const details = event.details || {}
    // Support both nested formData and flat top-level kpiRatings
    const form = (details.formData && typeof details.formData === 'object') ? details.formData : details

    if (Array.isArray(form.kpiRatings) && form.kpiRatings.length > 0) {
      const overall = form.overall ?? calculateWeightedKpiAverage(form.kpiRatings)
      return {
        kpis: form.kpiRatings,
        overall,
        averageRating: form.averageRating,
        strengths: form.strengths || '',
        improvements: form.improvements || '',
        comments: form.comments || ''
      }
    }
    if (Array.isArray(form.questions) && form.questions.length > 0) {
      const kpis = form.questions.map(q => ({
        name: q.question,
        rating: Number(q.rating || 4),
        score: Math.round((Number(q.rating || 4) / 5) * 100),
        comment: q.comment || ''
      }))
      const overall = calculateWeightedKpiAverage(kpis)
      return { kpis, overall, strengths: form.strengths || '', improvements: form.improvements || '', comments: form.comments || '' }
    }
  }
  return { kpis: [], overall: 0, strengths: '', improvements: '', comments: '' }
}

export function isAttendanceCriterion(c) {
  if (!c) return false
  const id = String(c.id || '')
  const name = String(c.name || '').toLowerCase()
  return id.endsWith('_3') || name.includes('punctual') || name.includes('attendance')
}

export function getHr2Rating(scoreNum) {
  const s = Number(scoreNum)
  if (s >= 95) return 5
  if (s >= 90) return 4
  if (s >= 80) return 3
  if (s >= 70) return 2
  return 1
}

function AssessmentBuilder({ value = {}, onChange, role, people = [], events = [], subject, workflow }) {
  const empSelfData = useMemo(() => extractKpiData(events, 'self_assessment'), [events])

  // Extract review context details from events or workflow
  const reviewCreationEvent = useMemo(() => (events || []).find(e => e.stage === 'create_review' || e.event_type === 'created'), [events])
  const createDetails = reviewCreationEvent?.details?.formData || reviewCreationEvent?.details || workflow?.metadata || {}
  
  const targetId = subject?.id || workflow?.subject_employee_id || createDetails?.employee?.id || (typeof createDetails?.employee === 'string' && !createDetails?.employee.includes(' ') ? createDetails?.employee : null)

  const [hr2Attendance, setHr2Attendance] = useState(null)
  useEffect(() => {
    if (!targetId) return
    let active = true
    api.employeeAttendance(targetId).then(res => {
      if (active && res?.record) setHr2Attendance(res.record)
    }).catch(() => {})
    return () => { active = false }
  }, [targetId])

  const employeeInfo = useMemo(() => {
    // 1. Resolve employee object and name
    const targetName = subject?.full_name || subject?.name || workflow?.subject_name || createDetails?.employee?.full_name || createDetails?.employee?.name || (typeof createDetails?.employee === 'string' ? createDetails?.employee : '') || createDetails?.employeeName || ''

    const matchedPerson = (people || []).find(p => 
      (targetId && (p.id === targetId || p.employee_id === targetId)) || 
      (targetName && (
        p.full_name?.toLowerCase() === targetName.toLowerCase() || 
        p.name?.toLowerCase() === targetName.toLowerCase()
      ))
    ) || {}

    const resolvedName = targetName || matchedPerson.full_name || matchedPerson.name || 'Staff Member'
    const resolvedPosition = matchedPerson.job_title || matchedPerson.position || subject?.position || subject?.job_title || subject?.role || createDetails?.position || 'Hospitality Associate'
    const resolvedDept = (createDetails?.department && createDetails.department !== 'All' ? createDetails.department : '') ||
      (workflow?.metadata?.department && workflow.metadata.department !== 'All' ? workflow.metadata.department : '') ||
      matchedPerson.department || subject?.department || 'Food & Beverage'

    // 2. Resolve Review Period (e.g. Q1, Q2, Q3, Q4, Annual)
    let rawPeriod = createDetails?.reviewPeriod || createDetails?.period || ''
    if (!rawPeriod) {
      // Check all events for reviewPeriod
      const evWithPeriod = (events || []).find(e => e.details?.reviewPeriod || e.details?.formData?.reviewPeriod)
      rawPeriod = evWithPeriod?.details?.reviewPeriod || evWithPeriod?.details?.formData?.reviewPeriod || ''
    }
    if (!rawPeriod && workflow?.title) {
      const match = workflow.title.match(/(Q[1-4]|Annual|Quarterly)/i)
      if (match) rawPeriod = match[0].toUpperCase()
    }
    
    let displayPeriod = rawPeriod || 'Q1'
    if (displayPeriod === 'Q1') displayPeriod = 'Quarterly (Q1)'
    else if (displayPeriod === 'Q2') displayPeriod = 'Quarterly (Q2)'
    else if (displayPeriod === 'Q3') displayPeriod = 'Quarterly (Q3)'
    else if (displayPeriod === 'Q4') displayPeriod = 'Quarterly (Q4)'
    else if (displayPeriod === 'Annual') displayPeriod = 'Annual Review'

    return {
      name: resolvedName,
      position: resolvedPosition,
      department: resolvedDept,
      period: displayPeriod,
      evalDate: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }, [subject, createDetails, people, events, workflow])

  // Get department-specific 14 criteria matrix
  const baseCriteria = useMemo(() => {
    return getDepartmentCriteria(employeeInfo.department)
  }, [employeeInfo.department])

  const kpis = value.kpiRatings || []
  // Only treat as matching if length AND first id match (department check)
  const savedFirstId = kpis.length > 0 ? (kpis[0]?.id || kpis[0]?.name) : null
  const baseFirstId = baseCriteria.length > 0 ? (baseCriteria[0]?.id || baseCriteria[0]?.name) : null
  const isMatchingDept = kpis.length > 0 && savedFirstId === baseFirstId
  const activeRatings = isMatchingDept ? kpis : baseCriteria.map(c => ({ ...c, rating: 4, score: 80, comment: '' }))

  // Only initialize when there is truly no saved data for this department.
  // NEVER overwrite kpiRatings that are already saved (submitted scores).
  useEffect(() => {
    if (kpis.length > 0 && isMatchingDept) return  // Already has correct saved data — do not touch
    if (kpis.length > 0 && !isMatchingDept) {
      // Department changed — reset for new department
    } else if (kpis.length === 0) {
      // No data yet — seed defaults
    } else {
      return
    }

    const defaultRating = 4
    const initialRatings = baseCriteria.map((c, i) => {
      const isAtt = isAttendanceCriterion(c) || i === 2
      let rating = defaultRating
      if (isAtt && hr2Attendance) {
        rating = getHr2Rating(hr2Attendance.attendance_score)
      }
      return {
        id: c.id || c.name,
        name: c.name,
        description: c.description,
        target: c.target || '90%',
        weight: c.weight,
        rating,
        score: Math.round((rating / 5) * 100),
        comment: isAtt && hr2Attendance ? `Verified via HR2 Biometrics: ${hr2Attendance.days_present}/${hr2Attendance.total_working_days || 60} days present, ${hr2Attendance.days_absent} absences, ${hr2Attendance.tardy_count} lates (${hr2Attendance.attendance_score}% DTR).` : '',
        isLockedByHr2: isAtt,
      }
    })
    const avgRating = (initialRatings.reduce((sum, k) => sum + k.rating, 0) / initialRatings.length).toFixed(2)
    const overall = calculateWeightedKpiAverage(initialRatings)
    onChange({ 
      ...value, 
      kpiRatings: initialRatings, 
      averageRating: Number(avgRating), 
      overall,
      strengths: value.strengths || '',
      improvements: value.improvements || '',
      comments: value.comments || '',
      role: role || '' 
    })
  }, [baseCriteria, employeeInfo.department, hr2Attendance])

  // Sync Criterion #3 when hr2Attendance loads asynchronously
  useEffect(() => {
    if (!hr2Attendance || !value.kpiRatings?.length) return
    const hr2Score = Number(hr2Attendance.attendance_score)
    const hr2Rating = getHr2Rating(hr2Score)
    const targetIdx = value.kpiRatings.findIndex((c, i) => isAttendanceCriterion(c) || i === 2)
    if (targetIdx >= 0) {
      const current = value.kpiRatings[targetIdx]
      if (current.rating !== hr2Rating || !current.isLockedByHr2) {
        const updated = value.kpiRatings.map((row, i) => {
          if (i !== targetIdx) return row
          return {
            ...row,
            rating: hr2Rating,
            score: Math.round((hr2Rating / 5) * 100),
            comment: row.comment || `Verified via HR2 Biometrics: ${hr2Attendance.days_present}/${hr2Attendance.total_working_days || 60} days present, ${hr2Attendance.days_absent} absences, ${hr2Attendance.tardy_count} lates (${hr2Score}% DTR).`,
            isLockedByHr2: true,
          }
        })
        const avgRating = (updated.reduce((sum, k) => sum + Number(k.rating || 0), 0) / updated.length).toFixed(2)
        const overall = calculateWeightedKpiAverage(updated)
        onChange({
          ...value,
          kpiRatings: updated,
          averageRating: Number(avgRating),
          overall,
        })
      }
    }
  }, [hr2Attendance, value.kpiRatings])

  const handleRatingSelect = (index, ratingNum) => {
    const targetRow = activeRatings[index]
    if (isAttendanceCriterion(targetRow) || index === 2 || targetRow?.isLockedByHr2) {
      // PREVENT EDITING: Attendance score is locked by HR2 DTR verification
      return
    }
    const currentList = activeRatings
    const updated = currentList.map((row, i) => {
      if (i !== index) return row
      const score = Math.round((ratingNum / 5) * 100)
      return { ...row, rating: ratingNum, score }
    })
    const avgRating = (updated.reduce((sum, k) => sum + Number(k.rating || 0), 0) / updated.length).toFixed(2)
    const overall = calculateWeightedKpiAverage(updated)
    onChange({ 
      ...value, 
      kpiRatings: updated, 
      averageRating: Number(avgRating), 
      overall 
    })
  }

  const totalAverage = value.averageRating ?? (activeRatings.reduce((s, k) => s + (k.rating || 4), 0) / activeRatings.length).toFixed(2)
  const totalPercentage = value.overall ?? Math.round((totalAverage / 5) * 100)

  const getPerformanceBadge = (pct) => {
    if (pct >= 90) return { label: 'Excellent (Role Model)', color: '#10b981', bg: '#ecfdf5' }
    if (pct >= 80) return { label: 'Good (Exceeds Standards)', color: '#111827', bg: '#f3f4f6' }
    if (pct >= 70) return { label: 'Satisfactory (Meets Standards)', color: '#0284c7', bg: '#f0f9ff' }
    if (pct >= 60) return { label: 'Fair (Needs Improvement)', color: '#d97706', bg: '#fffbeb' }
    return { label: 'Poor (Critical Action Required)', color: '#ef4444', bg: '#fef2f2' }
  }

  const badge = getPerformanceBadge(totalPercentage)

  return (
    <div className="builder hospitality-eval-form">
      {/* 1. Header Information (matching attached template) */}
      <div className="hospitality-eval-header-card">
        <div className="eval-doc-title">
          <h2>Hotel & Restaurant Employee Evaluation Form</h2>
          <p>{employeeInfo.department} Department · Performance Appraisal & Hospitality Competency Assessment</p>
        </div>

        <div className="eval-info-grid">
          <div className="eval-info-item">
            <span className="eval-info-label">Employee's Name:</span>
            <span className="eval-info-val">{employeeInfo.name}</span>
          </div>
          <div className="eval-info-item">
            <span className="eval-info-label">Department:</span>
            <span className="eval-info-val">{employeeInfo.department}</span>
          </div>
          <div className="eval-info-item">
            <span className="eval-info-label">Position / Role:</span>
            <span className="eval-info-val">{employeeInfo.position}</span>
          </div>
          <div className="eval-info-item">
            <span className="eval-info-label">Date of Evaluation:</span>
            <span className="eval-info-val">{employeeInfo.evalDate}</span>
          </div>
          <div className="eval-info-item">
            <span className="eval-info-label">Evaluator's Name:</span>
            <span className="eval-info-val">
              {role === 'employee' ? `${employeeInfo.name} (Self-Assessment)` : 'Supervisor / Department Head'}
            </span>
          </div>
          <div className="eval-info-item">
            <span className="eval-info-label">Evaluation Period:</span>
            <span className="eval-info-val">{employeeInfo.period}</span>
          </div>
        </div>
      </div>

      {/* HR2 Biometric Attendance Integration Card */}
      {hr2Attendance && (
        <div className="hr2-eval-insight-box">
          <div className="hr2-eval-head">
            <div className="hr2-eval-title">
              <Clock size={16} style={{ color: '#4f46e5' }} />
              <span>HR2 Biometric Attendance &amp; Punctuality Record</span>
              {hr2Attendance.is_perfect_attendance && (
                <span className="hr2-badge-perfect">⭐ Perfect Attendance</span>
              )}
            </div>
            <span className="hr2-eval-source-pill">
              ✓ Synced from HR2 Core DTR
            </span>
          </div>

          <div className="hr2-eval-grid">
            <div>
              <div className="hr2-eval-stat-label">Days Present</div>
              <div className="hr2-eval-stat-val">
                {hr2Attendance.days_present} / {hr2Attendance.total_working_days || 60} days
              </div>
            </div>
            <div>
              <div className="hr2-eval-stat-label">Absences</div>
              <div className="hr2-eval-stat-val" style={{ color: hr2Attendance.days_absent === 0 ? '#10b981' : '#ef4444' }}>
                {hr2Attendance.days_absent} day{hr2Attendance.days_absent === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div className="hr2-eval-stat-label">Tardiness</div>
              <div className="hr2-eval-stat-val" style={{ color: hr2Attendance.tardy_count === 0 ? '#10b981' : '#f59e0b' }}>
                {hr2Attendance.tardy_count === 0 ? '0 (On-Time)' : `${hr2Attendance.tardy_count}x (${hr2Attendance.tardy_minutes}m)`}
              </div>
            </div>
            <div>
              <div className="hr2-eval-stat-label">HR2 Attendance Score</div>
              <div className="hr2-eval-stat-val" style={{ color: Number(hr2Attendance.attendance_score) >= 95 ? '#10b981' : '#3b82f6' }}>
                {Number(hr2Attendance.attendance_score).toFixed(1)}%
              </div>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#64748b' }}>
            ℹ️ Objective biometric record from HR2. Serves as empirical basis for Punctuality, Attendance, and Reliability criteria.
          </p>
        </div>
      )}

      {/* 2. Rating Scale Reference Bar */}
      <div className="eval-rating-scale-legend">
        <span className="scale-title">Performance Rating Scale:</span>
        <div className="scale-chips-row">
          {RATING_SCALE_LEGEND.map(s => (
            <div className="scale-chip" key={s.rating}>
              <b className="scale-num">{s.rating}</b>
              <span className="scale-name">{s.label}</span>
              <small className="scale-desc">({s.rating * 20}%)</small>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Performance Criteria Table (14 Department-Specific Items) */}
      <div className="eval-table-container">
        <table className="hospitality-eval-table">
          <thead>
            <tr>
              <th className="th-criteria" style={{ width: '24%' }}>Criteria</th>
              <th className="th-desc" style={{ width: '40%' }}>Description</th>
              <th className="th-rating" style={{ width: '6%' }}>1<small>Poor</small></th>
              <th className="th-rating" style={{ width: '6%' }}>2<small>Fair</small></th>
              <th className="th-rating" style={{ width: '6%' }}>3<small>Sat.</small></th>
              <th className="th-rating" style={{ width: '6%' }}>4<small>Good</small></th>
              <th className="th-rating" style={{ width: '6%' }}>5<small>Exc.</small></th>
              <th className="th-score" style={{ width: '6%' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {activeRatings.map((row, index) => {
              const selectedRating = row.rating || 4
              const rowPercentage = Math.round((selectedRating / 5) * 100)
              const isLocked = isAttendanceCriterion(row) || index === 2 || Boolean(row.isLockedByHr2)

              return (
                <tr key={index} className={selectedRating >= 4 ? 'row-high' : selectedRating <= 2 ? 'row-low' : ''} style={isLocked ? { background: 'rgba(254, 243, 199, 0.15)' } : {}}>
                  <td className="td-criteria">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b>{row.name}</b>
                      {isLocked && (
                        <Lock size={13} style={{ color: '#d97706', flexShrink: 0 }} title="Locked: Synced directly from HR2 Biometrics" />
                      )}
                    </div>
                    {row.weight && <span className="kpi-weight-badge">{row.weight}% weight</span>}
                    {isLocked && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fde68a'
                        }}>
                          🔒 Locked: Verified by HR2 Biometrics ({hr2Attendance?.attendance_score ? `${hr2Attendance.attendance_score}%` : `${rowPercentage}%`})
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="td-desc">
                    <p>{row.description}</p>
                  </td>
                  {[1, 2, 3, 4, 5].map(ratingNum => (
                    <td 
                      key={ratingNum} 
                      className={`td-rating-cell ${selectedRating === ratingNum ? 'selected' : ''}`}
                      style={isLocked ? { cursor: 'not-allowed', opacity: selectedRating === ratingNum ? 1 : 0.35 } : {}}
                      onClick={() => !isLocked && handleRatingSelect(index, ratingNum)}
                      title={isLocked ? "This rating is locked and verified from HR2 Daily Time Records." : undefined}
                    >
                      <label className="eval-radio-label" style={isLocked ? { cursor: 'not-allowed' } : {}}>
                        <input 
                          type="radio" 
                          name={`criteria-rating-${index}`} 
                          checked={selectedRating === ratingNum} 
                          disabled={isLocked}
                          onChange={() => !isLocked && handleRatingSelect(index, ratingNum)}
                        />
                        <span className="eval-custom-radio" />
                      </label>
                    </td>
                  ))}
                  <td className="td-score">
                    <span className={`eval-score-pill score-${selectedRating}`}>
                      {rowPercentage}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Qualitative Performance Feedback Section */}
      <div className="hospitality-qualitative-card">
        <h4 className="qualitative-heading">Specific Examples of Performance</h4>
        
        <div className="qualitative-field">
          <label>
            <b>Strengths:</b>
            <small>Detail the employee's strengths and hospitality achievements. Include specific examples.</small>
          </label>
          <textarea 
            rows={3} 
            value={value.strengths || ''} 
            onChange={e => onChange({ ...value, strengths: e.target.value })} 
            placeholder="e.g. Excellent operational accuracy, high dependability during rush hours..."
          />
        </div>

        <div className="qualitative-field">
          <label>
            <b>Areas for Improvement:</b>
            <small>Detail areas where the employee could improve and development targets.</small>
          </label>
          <textarea 
            rows={3} 
            value={value.improvements || ''} 
            onChange={e => onChange({ ...value, improvements: e.target.value })} 
            placeholder="e.g. Enhance technical knowledge, improve station turnover speed..."
          />
        </div>

        <div className="qualitative-field">
          <label>
            <b>Additional Comments:</b>
            <small>Any additional observations or notes related to performance and conduct.</small>
          </label>
          <textarea 
            rows={2} 
            value={value.comments || ''} 
            onChange={e => onChange({ ...value, comments: e.target.value })} 
            placeholder="Optional additional notes..."
          />
        </div>
      </div>

      {/* 5. Live Score & Percentage Summary Card */}
      <div className="hospitality-score-summary-card">
        <div className="summary-col">
          <span className="summary-label">Average Evaluation Rating</span>
          <div className="summary-rating-big">
            <b>{totalAverage}</b> <small>/ 5.0</small>
          </div>
        </div>

        <div className="summary-divider" />

        <div className="summary-col">
          <span className="summary-label">Equivalent Total Percentage</span>
          <div className="summary-percentage-big">
            <b>{totalPercentage}%</b>
          </div>
        </div>

        <div className="summary-divider" />

        <div className="summary-col badge-col">
          <span className="summary-label">Hospitality Performance Level</span>
          <span className="summary-grade-badge" style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}30` }}>
            {badge.label}
          </span>
        </div>
      </div>
    </div>
  )
}

// ------------------------- Builder: Calibration (HR) ----------------------------

function CalibrationBuilder({ value = {}, onChange, events = [], subject, workflow, people = [] }) {
  const empData = extractKpiData(events, 'self_assessment')
  const deptData = extractKpiData(events, 'performance_evaluation')

  // Resolve department to pull proper 14-item criteria
  const targetId = subject?.id || workflow?.subject_employee_id
  const targetName = subject?.full_name || workflow?.subject_name
  const matchedPerson = (people || []).find(p => (targetId && p.id === targetId) || (targetName && p.full_name?.toLowerCase() === targetName.toLowerCase()))
  const resolvedDept = matchedPerson?.department || workflow?.metadata?.department || 'Food & Beverage'
  const deptCriteria = getDepartmentCriteria(resolvedDept)

  // Use department criteria
  const baseKpis = deptCriteria

  const kpiComparisons = baseKpis.map((kpi, i) => {
    const empMatch = empData.kpis.find(d => d.name === (kpi.name || kpi.title) || d.id === kpi.id) || empData.kpis[i] || { rating: 4, score: 80, comment: '' }
    const deptMatch = deptData.kpis.find(d => d.name === (kpi.name || kpi.title) || d.id === kpi.id) || deptData.kpis[i] || { rating: 4, score: 80, comment: '' }
    
    const target = kpi.target || '90%'
    const weight = Number(kpi.weight) || (100 / baseKpis.length)
    const empRating = Number(empMatch.rating || Math.round((empMatch.score || 80) / 20))
    const deptRating = Number(deptMatch.rating || Math.round((deptMatch.score || 80) / 20))
    const empScore = Number(empMatch.score || empRating * 20)
    const deptScore = Number(deptMatch.score || deptRating * 20)
    
    const diff = Math.round((empScore - deptScore) * 10) / 10
    const ratingDiff = empRating - deptRating
    const absDiff = Math.abs(diff)

    return {
      name: kpi.name || kpi.title,
      description: kpi.description || '',
      target,
      weight,
      empRating,
      deptRating,
      empScore,
      deptScore,
      diff,
      ratingDiff,
      absDiff,
      isDisagreement: absDiff >= 10,
      empComment: empMatch.comment || '',
      deptComment: deptMatch.comment || ''
    }
  })

  const overallEmpAvg = empData.overall || calculateWeightedKpiAverage(kpiComparisons.map(k => ({ score: k.empScore, weight: k.weight })))
  const overallDeptAvg = deptData.overall || calculateWeightedKpiAverage(kpiComparisons.map(k => ({ score: k.deptScore, weight: k.weight })))
  const overallDiff = Math.round((overallEmpAvg - overallDeptAvg) * 10) / 10
  const absOverallDiff = Math.abs(overallDiff)

  const empRatingAvg = (overallEmpAvg / 20).toFixed(2)
  const deptRatingAvg = (overallDeptAvg / 20).toFixed(2)

  const decision = value.decision || ''
  const isOverride = decision === 'Override Final Score' || decision === 'Custom HR Calibrated Score'
  const isReturn = decision === 'Return for Revision' || decision === 'Return Evaluation for Revision'

  const handleDecisionSelect = opt => {
    let calculatedFinal = ''
    if (opt.includes('Supervisor') || opt.includes('Department Head')) calculatedFinal = overallDeptAvg
    else if (opt.includes('Self-Assessment') || opt.includes('Employee')) calculatedFinal = overallEmpAvg
    else if (opt.includes('Average') || opt.includes('Balanced')) calculatedFinal = Math.round(((overallEmpAvg + overallDeptAvg) / 2) * 10) / 10
    else if (opt.includes('Override') || opt.includes('Custom')) calculatedFinal = value.finalScore ?? overallDeptAvg
    else calculatedFinal = ''

    onChange({
      ...value,
      decision: opt,
      finalScore: calculatedFinal,
      employeeAvg: overallEmpAvg,
      deptAvg: overallDeptAvg,
      overallDiff,
      kpiComparisons
    })
  }

  return (
    <div className="builder calibration-builder">
      {/* Overview Score Cards */}
      <div className="calibration-summary-grid">
        <div className="calibration-card emp-card">
          <span className="card-tag">Employee Self-Assessment</span>
          <b className="card-score">{overallEmpAvg}%</b>
          <small className="card-sub">{empRatingAvg} / 5.0 Rating</small>
        </div>

        <div className="calibration-card diff-card">
          <span className="card-tag">Score Variance</span>
          <b className={`card-diff ${overallDiff > 0 ? 'diff-pos' : overallDiff < 0 ? 'diff-neg' : ''}`}>
            {overallDiff > 0 ? `+${overallDiff}` : overallDiff}%
          </b>
          <small className="card-sub">
            {absOverallDiff >= 10 ? <><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Significant Gap</> : 'Within Standard Range'}
          </small>
        </div>

        <div className="calibration-card dept-card">
          <span className="card-tag">Supervisor Evaluation</span>
          <b className="card-score">{overallDeptAvg}%</b>
          <small className="card-sub">{deptRatingAvg} / 5.0 Rating</small>
        </div>
      </div>

      {/* Side-by-Side Criteria Table */}
      <div className="calibration-section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h4>Hotel & Restaurant Criteria Comparison</h4>
          <small>Side-by-side breakdown of 1–5 ratings and percentage scores.</small>
        </div>

        <div className="calibration-table-wrap">
          <table className="calibration-table">
            <thead>
              <tr>
                <th>Evaluation Criteria</th>
                <th style={{ textAlign: 'center' }}>Employee Rating</th>
                <th style={{ textAlign: 'center' }}>Supervisor Rating</th>
                <th style={{ textAlign: 'center' }}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {kpiComparisons.map((row, idx) => (
                <tr key={idx} className={row.isDisagreement ? 'row-alert' : ''}>
                  <td>
                    <b>{row.name}</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 2 }}>{row.description}</small>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="calib-rating-pill emp">
                      {row.empRating} / 5 <small>({row.empScore}%)</small>
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="calib-rating-pill sup">
                      {row.deptRating} / 5 <small>({row.deptScore}%)</small>
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`calib-diff-pill ${row.diff > 0 ? 'pos' : row.diff < 0 ? 'neg' : 'zero'}`}>
                      {row.diff > 0 ? `+${row.diff}%` : `${row.diff}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Qualitative Feedback Review */}
      {(empData.strengths || deptData.strengths || empData.improvements || deptData.improvements) && (
        <div className="calibration-qualitative-review" style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Qualitative Feedback Review</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="calib-feedback-box" style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <b style={{ color: '#111827', fontSize: 12 }}>Employee Self-Identified Strengths</b>
              <p style={{ fontSize: 12, margin: '6px 0 0', color: '#475569' }}>
                {empData.strengths || 'No specific strengths entered.'}
              </p>
            </div>

            <div className="calib-feedback-box" style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <b style={{ color: '#0f766e', fontSize: 12 }}>Supervisor-Identified Strengths</b>
              <p style={{ fontSize: 12, margin: '6px 0 0', color: '#475569' }}>
                {deptData.strengths || 'No specific strengths entered.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HR Calibration Decision Controls */}
      <div className="calibration-decision-card" style={{ marginTop: 24 }}>
        <h4>HR Calibration Decision</h4>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 16px' }}>Select the final resolution for this employee's performance evaluation percentage score:</p>

        <div className="decision-options-grid">
          {[
            { id: 'Accept Department Head Score', label: 'Accept Supervisor Evaluation', score: `${overallDeptAvg}%`, sub: 'Official supervisor rating' },
            { id: 'Use Average of Scores', label: 'Apply Balanced Average (50/50)', score: `${Math.round(((overallEmpAvg + overallDeptAvg)/2) * 10) / 10}%`, sub: 'Blend self and supervisor scores' },
            { id: 'Accept Employee Self-Assessment', label: 'Accept Employee Self-Assessment', score: `${overallEmpAvg}%`, sub: 'Adopt employee self-rating' },
            { id: 'Override Final Score', label: 'Custom HR Calibrated Score', score: 'Custom %', sub: 'HR adjustment with justification' },
            { id: 'Return for Revision', label: 'Return Evaluation for Revision', score: 'Revision', sub: 'Send back to Supervisor' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`decision-btn ${decision === opt.id || decision === opt.label ? 'selected' : ''}`}
              onClick={() => handleDecisionSelect(opt.id)}
            >
              <div className="decision-btn-head">
                <span className="decision-btn-title">{opt.label}</span>
                <span className="decision-btn-score">{opt.score}</span>
              </div>
              <small className="decision-btn-sub">{opt.sub}</small>
            </button>
          ))}
        </div>

        {/* Final Calibrated Score Display / Input */}
        {decision && !isReturn && (
          <div className="final-score-box" style={{ marginTop: 16, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Final Calibrated Performance Score (%):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={value.finalScore ?? ''}
                disabled={!isOverride}
                onChange={e => onChange({ ...value, finalScore: e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))) })}
                style={{ width: 100, padding: '8px 12px', fontSize: 15, fontWeight: 700, borderRadius: 8, border: '1px solid #c7d2fe', background: isOverride ? '#fff' : '#f1f5f9' }}
              />
              <span style={{ fontWeight: 700 }}>%</span>
            </div>
            <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 4 }}>
              {isOverride ? 'Enter custom calibrated percentage score.' : 'Authoritative percentage score that will be saved and published.'}
            </small>
          </div>
        )}

        {/* Calibration Notes */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Calibration Notes & Justification:
          </label>
          <textarea
            value={value.reason || ''}
            onChange={e => onChange({ ...value, reason: e.target.value })}
            rows={3}
            placeholder="Add HR calibration observations, discussion notes, or alignment rationale..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
          />
        </div>
      </div>
    </div>
  )
}

// ------------------- Builder: Skill Gap & Learning Plan -------------------

function SkillGapPlanBuilder({ value, onChange, role, people = [], subject }) {
  // Guard: value may arrive as undefined before formData is seeded
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  const [selectedCompetency, setSelectedCompetency] = useState('')
  // Per-competency map of { [competencyName]: courseTitle } for assigned courses
  const [assignedMap, setAssignedMap] = useState({})
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [gaps, setGaps] = useState([])
  const [loadingGaps, setLoadingGaps] = useState(false)
  // AI Auto-Assign All Gaps
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoProgress, setAutoProgress] = useState(0)
  const [autoLog, setAutoLog] = useState([])

  const subjectEmp = subject || (Array.isArray(people) && people.length > 0 ? people[0] : null)
  const employeeId = subjectEmp?.id || subjectEmp?.employee_id
  const subjectName = subjectEmp?.full_name || 'Employee'
  const isEmployee = role === 'employee'

  // Stable loadGaps — loads real gaps AND existing persistent assignments from DB
  const loadGaps = useCallback(async (cancelledRef = { current: false }) => {
    if (!employeeId) return
    setLoadingGaps(true)
    setError('')
    try {
      const [result, assignResult] = await Promise.all([
        api.learningSkillGaps({ employeeId }),
        api.learningAssignments().catch(() => ({ assignments: [] })),
      ])
      if (cancelledRef.current) return
      const list = Array.isArray(result?.skillGaps)
        ? result.skillGaps
        : (Array.isArray(result?.gaps) ? result.gaps : [])
      setGaps(list)
      setSelectedCompetency(prev =>
        list.some(g => g.competency === prev)
          ? prev
          : (list[0]?.competency || 'Customer Service Excellence')
      )

      // Populate assignedMap from persistent database assignments for this employee
      const persistentMap = {}
      for (const a of assignResult.assignments || []) {
        if (a.employee_id === employeeId || !employeeId) {
          for (const c of a.competencies || []) {
            persistentMap[c] = a.resource_title
          }
          if (a.fromCompetencyGap && a.category) {
            persistentMap[a.category] = a.resource_title
          }
        }
      }
      setAssignedMap(prev => ({ ...persistentMap, ...prev }))
    } catch (err) {
      if (!cancelledRef.current) setError(err?.message || 'Could not load skill gaps.')
    } finally {
      if (!cancelledRef.current) setLoadingGaps(false)
    }
  }, [employeeId])

  useEffect(() => {
    const ref = { current: false }
    void loadGaps(ref)
    return () => { ref.current = true }
  }, [loadGaps])

  // Recommended courses: prefer real library courses already tagged with the
  // competency (attached by the server), then fall back to the curated
  // competency→learning template map.
  // Recommended courses: strictly aligned with the selected competency gap
  const recommendedCourses = useMemo(() => {
    const gap = gaps.find(g => g.competency === selectedCompetency)
    const dbCourses = (gap?.courses || gap?.recommendedResources || []).filter(c => {
      // Ensure the course doesn't carry irrelevant cross-department terms if we're evaluating Front Office
      const titleLower = (c.title || '').toLowerCase()
      const compLower = selectedCompetency.toLowerCase()
      if (compLower.includes('customer') || compLower.includes('reservation') || compLower.includes('communication') || compLower.includes('conflict')) {
        if (titleLower.includes('kitchen') || titleLower.includes('haccp') || titleLower.includes('housekeep') || titleLower.includes('engineering')) {
          return false
        }
      }
      return true
    })

    if (dbCourses.length > 0) return dbCourses

    // Fall back to our comprehensive competency -> course alignment map
    return getRecommendedCoursesForGap(selectedCompetency, gap?.score || 0)
  }, [gaps, selectedCompetency])

  const handleAssignCourse = async (course) => {
    if (!employeeId) {
      setError('Please select or assign an employee first.')
      return
    }
    setAssigning(true)
    setError('')
    try {
      await api.assignLearningGap({
        subjectEmployeeId: employeeId,
        courseTitle: course.title,
        competencyName: selectedCompetency,
        gapScore: gaps.find(g => g.competency === selectedCompetency)?.gap || 0,
      })
      // Persist the assignment badge per competency so it survives tab switches.
      setAssignedMap(prev => ({ ...prev, [selectedCompetency]: course.title }))
      setNotice(`Learning path "${course.title}" assigned to ${subjectName} to close the ${selectedCompetency} gap.`)
      onChange({
        ...safeValue,
        planTitle: safeValue.planTitle || `Dev Plan: ${selectedCompetency}`,
        assignedCourse: course.title,
        prioritySkills: Array.isArray(safeValue.prioritySkills)
          ? [...new Set([...safeValue.prioritySkills, selectedCompetency])]
          : [selectedCompetency],
        assignedFromCompetencyGap: true,
        competencyName: selectedCompetency,
      })
      // Reload gaps — the server may have created a new library resource which
      // will now appear in the courses list for this competency.
      await loadGaps()
    } catch (err) {
      setError(err.message || 'Could not assign course.')
    } finally {
      setAssigning(false)
    }
  }

  // Clear transient notices when the user switches to a different gap.
  const handleSelectCompetency = (comp) => {
    setSelectedCompetency(comp)
    setNotice('')
    setError('')
  }

  // AI Auto-Assign: iterate every unassigned gap, pick best course, assign it.
  const handleAutoAssignAll = async () => {
    const unassigned = gaps.filter(g => !assignedMap[g.competency])
    if (!unassigned.length || !employeeId) return
    setAutoAssigning(true)
    setAutoProgress(0)
    setAutoLog([])
    setNotice('')
    setError('')

    const newMap = { ...assignedMap }
    const log = []
    const allAssigned = []

    for (let i = 0; i < unassigned.length; i++) {
      const g = unassigned[i]
      // Pick the best course for this gap
      const courses = g.courses?.length
        ? g.courses
        : (g.recommendedResources?.length ? g.recommendedResources : getRecommendedCoursesForGap(g.competency, g.score || 0))
      const course = courses[0]
      if (!course) {
        log.push({ gap: g.competency, course: null, status: 'skip' })
        setAutoLog([...log])
        setAutoProgress(Math.round(((i + 1) / unassigned.length) * 100))
        continue
      }

      try {
        await api.assignLearningGap({
          subjectEmployeeId: employeeId,
          courseTitle: course.title,
          competencyName: g.competency,
          gapScore: g.gap || 0,
        })
        newMap[g.competency] = course.title
        allAssigned.push(g.competency)
        log.push({ gap: g.competency, course: course.title, status: 'ok' })
      } catch (err) {
        log.push({ gap: g.competency, course: course.title, status: 'error', msg: err.message })
      }

      setAssignedMap({ ...newMap })
      setAutoLog([...log])
      setAutoProgress(Math.round(((i + 1) / unassigned.length) * 100))

      // Small delay between assignments so the server isn't hammered
      if (i < unassigned.length - 1) await new Promise(r => setTimeout(r, 280))
    }

    // Commit all assigned competencies to the parent form value
    if (allAssigned.length > 0) {
      onChange({
        ...safeValue,
        planTitle: safeValue.planTitle || `AI Dev Plan: ${subjectName}`,
        prioritySkills: [...new Set([...(Array.isArray(safeValue.prioritySkills) ? safeValue.prioritySkills : []), ...allAssigned])],
        assignedFromCompetencyGap: true,
        aiAutoAssigned: true,
      })
    }

    setAutoAssigning(false)
    setNotice(
      allAssigned.length > 0
        ? `AI assigned ${allAssigned.length} development ${allAssigned.length === 1 ? 'plan' : 'plans'} to ${subjectName} targeting all detected skill gaps.`
        : 'No courses could be assigned. Please check the error log above.'
    )
    await loadGaps()
  }

  const set = patch => onChange({ ...safeValue, ...patch })

  return (
    <div className="builder skill-gap-builder">
      {/* Skill Gaps Overview */}
      <div className="skill-gaps-section">
        <div className="section-head">
          <div>
            <h4>Detected Skill Gaps for {subjectName}</h4>
            <span className="section-hint">Click a skill gap to view recommended learning courses</span>
          </div>
          {/* AI Auto-Assign Button */}
          {gaps.length > 0 && (
            <button
              type="button"
              className="ai-auto-assign-btn"
              disabled={autoAssigning || assigning || gaps.every(g => assignedMap[g.competency])}
              onClick={handleAutoAssignAll}
              title="AI will automatically pick and assign the best-matching development course for every skill gap in one click"
            >
              <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              {autoAssigning ? `Assigning… ${autoProgress}%` : 'AI Auto-Assign All Gaps'}
            </button>
          )}
        </div>

        {/* AI Progress Bar */}
        {autoAssigning && (
          <div style={{ margin: '6px 0 2px', background: 'rgba(17,24,39,0.08)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(17,24,39,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>AI is assigning development plans…</span>
              <span style={{ fontSize: 11, color: '#111827' }}>{autoProgress}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(17,24,39,0.15)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${autoProgress}%`, background: 'linear-gradient(90deg, #111827, #10b981)', borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* AI Assignment Log */}
        {autoLog.length > 0 && !autoAssigning && (
          <div style={{ margin: '6px 0', background: 'rgba(16,185,129,0.05)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(16,185,129,0.18)', maxHeight: 140, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 5 }}>AI Assignment Summary</div>
            {autoLog.map((entry, idx) => (
              <div key={idx} style={{ fontSize: 11, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                {entry.status === 'ok'
                  ? <CheckCircle size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                  : entry.status === 'skip'
                  ? <AlertTriangle size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  : <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                }
                <span style={{ color: 'inherit', fontWeight: 600 }}>{entry.gap}:</span>
                <span style={{ color: entry.status === 'ok' ? '#10b981' : entry.status === 'skip' ? '#94a3b8' : '#ef4444' }}>
                  {entry.status === 'ok' ? entry.course : entry.status === 'skip' ? 'No course found' : `Error – ${entry.msg}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {loadingGaps ? (
          <p className="empty-hint">Loading skill gaps…</p>
        ) : gaps.length === 0 ? (
          <div className="no-gaps-panel" style={{ padding: '14px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)', margin: '8px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', marginBottom: '6px' }}>
              <CheckCircle size={16} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>All core competencies meet or exceed required level</span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
              No critical skill gaps detected. You can still assign an elective development path or upskilling course for {subjectName} by choosing a target competency below:
            </p>
            <div className="gap-cards-grid" style={{ marginTop: '8px' }}>
              {[
                'Customer Service Excellence',
                'Hospitality SOP Compliance',
                'Safety, Sanitation & HACCP',
                'Team Collaboration & Interdepartmental Comm.',
                'Technical Operational Proficiency',
                'Leadership & Problem Solving'
              ].map(comp => (
                <button
                  key={comp}
                  type="button"
                  className={`gap-card ${selectedCompetency === comp ? 'active' : ''}${assignedMap[comp] ? ' assigned' : ''}`}
                  onClick={() => handleSelectCompetency(comp)}
                >
                  <div className="gap-card-head">
                    <span className="gap-competency">{comp}</span>
                    {assignedMap[comp]
                      ? <span className="gap-pill assigned-pill"><CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Course assigned</span>
                      : <span className="gap-pill" style={{ background: 'rgba(17, 24, 39, 0.15)', color: '#9ca3af', borderColor: 'rgba(17, 24, 39, 0.3)' }}>Elective</span>
                    }
                  </div>
                  <div className="gap-card-foot" style={{ marginTop: '8px' }}>
                    <small>Standard Benchmark: 80%+</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="gap-cards-grid">
            {gaps.map(g => (
              <button
                key={g.competency}
                type="button"
                className={`gap-card ${selectedCompetency === g.competency ? 'active' : ''}${assignedMap[g.competency] ? ' assigned' : ''}`}
                onClick={() => handleSelectCompetency(g.competency)}
              >
                <div className="gap-card-head">
                  <span className="gap-competency">{g.competency}</span>
                  {assignedMap[g.competency]
                    ? <span className="gap-pill assigned-pill"><CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Course assigned</span>
                    : <span className="gap-pill">-{g.gap}% gap</span>
                  }
                </div>
                <div className="gap-score-bar">
                  <div className="score-fill" style={{ width: `${g.score}%` }} />
                </div>
                <div className="gap-card-foot">
                  <small>Current: {g.score}%</small>
                  <small>Target: {g.required_score}%</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Learning Courses */}
      {selectedCompetency && (
        <div className="recommended-learning-section">
          <h4>Recommended Courses for "{selectedCompetency}"</h4>
          <p className="field-hint">Select a course to auto-create and assign a Learning Path workflow for {subjectName}:</p>

          {notice && <div className="assigned-success-notice">{notice}</div>}
          {error && <p className="form-error">{error}</p>}

          <div className="recommended-courses-grid">
            {recommendedCourses.map(course => {
              const isAssigned = assignedMap[selectedCompetency] === course.title || Boolean(course.assignment_id)
              const isVerified = Boolean(course.is_completed)
              const progressPct = course.assignment_progress !== undefined && course.assignment_progress !== null ? Number(course.assignment_progress) : null

              return (
                <div className={`recommended-course-card ${isVerified ? 'is-verified' : ''}`} key={course.title}>
                  <div className="course-card-head">
                    <span className="course-category-tag">{course.category}</span>
                    <span className="course-duration" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {course.duration_hours || course.duration || '-'} hrs</span>
                  </div>
                  <h5 className="course-title">{course.title}</h5>
                  <p className="course-desc">{course.description}</p>
                  {course.objectives && <small className="course-objectives"><b>Objectives:</b> {course.objectives}</small>}

                  {/* Real-time Validation / Status Feedback */}
                  {isVerified ? (
                    <div style={{ margin: '8px 0', background: 'rgba(16,185,129,0.1)', color: '#065f46', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
                      <span>Verified Complete {course.completed_at ? `(${new Date(course.completed_at).toLocaleDateString()})` : ''} · Competency Score Updated</span>
                    </div>
                  ) : progressPct !== null ? (
                    <div style={{ margin: '8px 0', padding: '6px 10px', background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)', fontSize: 11, color: '#334155' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>Employee Study Progress: {progressPct}%</span>
                        <span style={{ textTransform: 'capitalize', color: '#64748b' }}>{course.assignment_status || 'Studying'}</span>
                      </div>
                      <div style={{ height: 4, background: '#cbd5e1', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: '#3b82f6', borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="assign-course-btn"
                    disabled={assigning || isAssigned}
                    onClick={() => handleAssignCourse(course)}
                  >
                    {isVerified
                      ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Completed &amp; Verified</>
                      : isAssigned
                      ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Learning Path Assigned</>
                      : assigning ? 'Assigning…' : <><Zap size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Assign Learning Path</>}
                  </button>
                </div>
              )
            })}
            {recommendedCourses.length === 0 && <p className="empty-hint">No recommended courses found for this competency.</p>}
          </div>
        </div>
      )}

      {/* Browse Full Course Library */}
      {selectedCompetency && (
        <BrowseLibraryPanel
          selectedCompetency={selectedCompetency}
          assignedMap={assignedMap}
          assigning={assigning}
          onAssign={handleAssignCourse}
        />
      )}

      {/* Optional Plan Notes */}
      <div className="plan-notes-section">
        <label className="form-field">
          <span>Development Plan Notes</span>
          <textarea
            value={safeValue.coachingNotes || ''}
            onChange={e => set({ coachingNotes: e.target.value })}
            rows={2}
            placeholder="Add coaching objectives or specific targets for this development plan..."
          />
        </label>
      </div>
    </div>
  )
}

// Expandable panel showing the full course library for a given competency,
// so HR can pick any course beyond the AI-recommended shortlist.
function BrowseLibraryPanel({ selectedCompetency, assignedMap, assigning, onAssign }) {
  const [expanded, setExpanded] = useState(false)
  const [allCourses, setAllCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [libQuery, setLibQuery] = useState('')
  const [libError, setLibError] = useState('')

  // Load library the first time the panel is expanded.
  useEffect(() => {
    if (!expanded || allCourses.length > 0) return
    setLoading(true)
    setLibError('')
    api.learningResources({}).then(res => {
      setAllCourses(res.resources || [])
    }).catch(err => {
      setLibError(err.message || 'Could not load course library.')
    }).finally(() => setLoading(false))
  }, [expanded])

  const visible = allCourses.filter(c => {
    const text = `${c.title} ${c.description} ${c.category} ${(c.competencies || []).join(' ')}`.toLowerCase()
    const matchComp = !selectedCompetency || text.includes(selectedCompetency.toLowerCase())
    const matchQ = !libQuery || text.includes(libQuery.toLowerCase())
    return matchComp && matchQ
  })

  return (
    <div className="browse-library-panel" style={{ marginTop: 12, border: '1px solid rgba(17, 24, 39, 0.2)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', background: expanded ? 'rgba(17, 24, 39, 0.08)' : 'rgba(248,250,252,0.9)',
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#111827',
          borderBottom: expanded ? '1px solid rgba(17, 24, 39, 0.15)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={13} /> Browse Full Course Library for "{selectedCompetency}"
        </span>
        <span style={{ fontSize: 10, color: '#111827', fontWeight: 600 }}>{expanded ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '10px 14px', background: 'rgba(248,250,252,0.7)' }}>
          <input
            type="text"
            value={libQuery}
            onChange={e => setLibQuery(e.target.value)}
            placeholder="Search all courses…"
            style={{ width: '100%', marginBottom: 10, padding: '6px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
          {loading && <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0' }}>Loading library…</p>}
          {libError && <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0' }}>{libError}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {visible.map(course => {
              const isAssigned = assignedMap[selectedCompetency] === course.title
              return (
                <div key={course.id} style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                  padding: '8px 10px', background: '#fff', borderRadius: 8,
                  border: `1px solid ${isAssigned ? '#a7f3d0' : 'rgba(148,163,184,0.2)'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{course.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{course.category}{course.duration_hours ? ` · ${course.duration_hours}h` : ''}</p>
                    {(course.competencies || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {course.competencies.map(c => (
                          <span key={c} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#111827' }}>{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={assigning || isAssigned}
                    onClick={() => onAssign(course)}
                    style={{
                      flexShrink: 0, padding: '5px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: 'none',
                      background: isAssigned ? '#d1fae5' : 'linear-gradient(135deg,#111827,#111827)',
                      color: isAssigned ? '#065f46' : '#fff', cursor: isAssigned ? 'default' : 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {isAssigned ? '✓ Assigned' : 'Assign'}
                  </button>
                </div>
              )
            })}
            {!loading && visible.length === 0 && (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                No courses found{libQuery ? ` for "${libQuery}"` : ''}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------- Builder: Competency template (selection-first) --------

function CompetencyTemplateBuilder({ value = [], onChange }) {
  const positions = Object.keys(COMPETENCY_TEMPLATES)
  const [selectedSkill, setSelectedSkill] = useState('')

  const apply = pos => {
    if (!pos) { onChange([]); return }
    const rows = COMPETENCY_TEMPLATES[pos].map(r => ({
      position: pos,
      competency: r.competency,
      level: r.level || 'Proficient',
      weight: r.weight || 20,
      category: r.category || 'Competency',
      targetScore: r.targetScore || LEVEL_SCORES[r.level] || 85,
      actual: Math.max(40, Math.min(100, Math.round((r.targetScore || LEVEL_SCORES[r.level] || 85) * (0.8 + Math.random() * 0.25)))),
    }))
    onChange(rows)
    if (rows.length > 0) setSelectedSkill(rows[0].competency)
  }

  const addCustomSkill = () => {
    const next = [
      ...value,
      {
        position: value[0]?.position || 'Custom Role',
        competency: 'New Competency',
        level: 'Proficient',
        weight: 15,
        category: 'Hospitality Service',
        targetScore: 88,
        actual: 75,
      }
    ]
    onChange(next)
  }

  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const levelColor = lvl => ({ Foundation: '#8a8792', Developing: '#b06948', Proficient: '#111827', Expert: '#31965b' }[lvl] || '#111827')

  return (
    <div className="builder competency-template-builder" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="competency-picker-field">
        <label className="competency-picker-label">
          <span>Select a Role-Based Benchmark Template</span>
          <select value={value.length > 0 ? value[0].position : ''} onChange={e => apply(e.target.value)}>
            <option value="">Choose a hospitality role benchmark…</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos} ({COMPETENCY_TEMPLATES[pos].length} benchmark competencies)</option>
            ))}
          </select>
          <small>Select a predefined hospitality role dictionary standard to auto-load standard competency benchmarks, proficiency target levels, and weights.</small>
        </label>
      </div>

      {value.length > 0 && (
        <>
          {/* Interactive Skill Radar Chart Visual Comparison */}
          <div style={{ marginTop: 4 }}>
            <SkillRadarChart
              competencies={value}
              roleName={value[0].position}
              employeeName="Subject Profile"
              selectedCompetency={selectedSkill}
              onSelectCompetency={setSelectedSkill}
              showTable={false}
              compact={false}
            />
          </div>

          <div className="competency-loaded">
            <div className="competency-loaded-head">
              <div>
                <b>{value[0].position} · Role Benchmark Matrix</b>
                <small>Predefined standard loaded — adjust requirements, targets, and weights as needed</small>
              </div>
              <span className={`weight-total ${totalWeight === 100 ? 'ok' : ''}`}>Total Weight: {totalWeight}%</span>
            </div>
            <div className="competency-table">
              {value.map((row, index) => (
                <div
                  className={`competency-table-row ${selectedSkill === row.competency ? 'selected-row' : ''}`}
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(110px, 1fr) 90px 80px 32px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                    background: selectedSkill === row.competency ? 'rgba(17,24,39,0.05)' : 'transparent',
                    borderRadius: 6,
                  }}
                  onClick={() => setSelectedSkill(row.competency)}
                >
                  <div className="competency-table-name">
                    <input
                      value={row.competency}
                      placeholder="Competency name"
                      onChange={e => {
                        const next = [...value]; next[index] = { ...row, competency: e.target.value }; onChange(next)
                      }}
                    />
                  </div>
                  <div className="competency-table-level">
                    <select
                      value={row.level}
                      style={{ borderColor: levelColor(row.level) }}
                      onChange={e => {
                        const lvl = e.target.value
                        const next = [...value]
                        next[index] = {
                          ...row,
                          level: lvl,
                          targetScore: LEVEL_SCORES[lvl] || 85,
                        }
                        onChange(next)
                      }}
                    >
                      <option value="">Level…</option>
                      {COMPETENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="competency-table-target" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <small style={{ fontSize: 10, color: '#64748b' }}>Target:</small>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={row.targetScore || LEVEL_SCORES[row.level] || 85}
                      onChange={e => {
                        const next = [...value]
                        next[index] = { ...row, targetScore: Number(e.target.value) }
                        onChange(next)
                      }}
                      style={{ width: 44, padding: '4px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}
                    />
                    <small style={{ fontSize: 10, color: '#64748b' }}>%</small>
                  </div>
                  <div className="competency-table-weight">
                    <input
                      type="number"
                      value={row.weight}
                      onChange={e => {
                        const next = [...value]; next[index] = { ...row, weight: e.target.value }; onChange(next)
                      }}
                      min={0}
                      max={100}
                      placeholder="Weight %"
                      title="Weight percentage"
                    />
                    <i className="weight-bar"><em style={{ width: `${Math.min(100, Number(row.weight) || 0)}%` }} /></i>
                  </div>
                  <button type="button" className="builder-remove" onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, i) => i !== index)) }} aria-label="Delete">×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button type="button" className="builder-add" onClick={addCustomSkill} style={{ margin: 0, padding: '6px 14px', fontSize: 12 }}>
                + Add Custom Skill Dimension
              </button>
              <small style={{ color: totalWeight === 100 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {totalWeight === 100 ? '✓ Total weight perfectly balanced at 100%' : `⚠ Total weight is ${totalWeight}% (must equal 100%)`}
              </small>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ------------------- Builder: Competency requirement -----------------------

function CompetencyRequirementBuilder({ value = [], onChange }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { position: '', competency: '', level: '', weight: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder requirement-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>Position<input value={row.position} onChange={e => set(index, { position: e.target.value })} placeholder="e.g. Front Office Supervisor" /></label>
            <label>Competency<input value={row.competency} onChange={e => set(index, { competency: e.target.value })} placeholder="e.g. Customer Service" /></label>
            <label>Required level<select value={row.level} onChange={e => set(index, { level: e.target.value })}><option value="">Level…</option><option>Foundation</option><option>Developing</option><option>Proficient</option><option>Expert</option></select></label>
            <label>Weight %<input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value })} min={0} max={100} /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete">×</button>
          </div>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Add requirement</button>
    </div>
  )
}

// ------------------------- Builder: Resources (from Learning Management) ---

function ResourcesBuilder({ value = [], onChange, subject, people = [], workflow }) {
  const [lmResources, setLmResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [notice, setNotice] = useState('')

  // Identify employee details from props or fetch if missing
  const [empInfo, setEmpInfo] = useState({
    name: subject?.full_name || subject?.name || workflow?.subject_name || '',
    department: subject?.department || '',
    jobTitle: subject?.job_title || subject?.position || '',
  })

  useEffect(() => {
    let active = true
    const targetId = subject?.id || subject?.employee_id || workflow?.subject_employee_id
    const targetName = subject?.full_name || subject?.name || workflow?.subject_name

    // First try to resolve from people prop
    if (Array.isArray(people) && people.length > 0) {
      const match = people.find(p => (targetId && (p.id === targetId || p.employee_id === targetId)) || (targetName && p.full_name?.toLowerCase() === targetName?.toLowerCase()))
      if (match && (match.department || match.job_title)) {
        setEmpInfo({
          name: match.full_name || targetName || 'Employee',
          department: match.department || '',
          jobTitle: match.job_title || '',
        })
        return
      }
    }

    // Otherwise fetch all employees to guarantee we have their true department & role
    api.workflowSubjects().then(res => {
      if (!active) return
      const list = res.employees || []
      const match = list.find(p => (targetId && (p.id === targetId || p.employee_id === targetId)) || (targetName && p.full_name?.toLowerCase() === targetName?.toLowerCase()))
      if (match) {
        setEmpInfo({
          name: match.full_name || targetName || 'Employee',
          department: match.department || '',
          jobTitle: match.job_title || '',
        })
      }
    }).catch(() => {})

    return () => { active = false }
  }, [subject, people, workflow])

  const employeeName = empInfo.name || 'Employee'
  const employeeDept = empInfo.department.trim()
  const employeeJob = empInfo.jobTitle.trim()

  useEffect(() => {
    let active = true
    api.learningResources().then(res => {
      if (active) {
        setLmResources(res.resources || [])
        setLoading(false)
      }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const linkedIds = new Set(value.map(r => r.id))

  // Department-specific allowed course titles and competency targets
  const FRONT_OFFICE_COURSES = ['Customer Service Excellence', 'Front Desk Excellence', 'Conflict Resolution', 'Hospitality De-escalation & Service Recovery', 'Emergency Procedures']
  const KITCHEN_COURSES = ['Kitchen Hygiene', 'Food Safety', 'HACCP & Kitchen Sanitation', 'Recipe Consistency & Flavor', 'Line Expediting & Speed']
  const HOUSEKEEPING_COURSES = ['Room Standards & Inspection', 'Chemical & Bio-Safety Compliance', 'Turnaround Time Optimization', 'Linen & Laundry', 'Public Area Cleanliness']
  const FB_COURSES = ['Floor Operations & Speed', 'Customer Service Excellence', 'Conflict Resolution', 'POS & Cash Reconciliation', 'Hygiene & Health Standards', 'Bar Speed & Multitasking']

  // Strict department filter: only show modules relevant to the employee's department and role
  const departmentFilteredResources = useMemo(() => {
    const dept = (employeeDept || '').toLowerCase()
    const job = (employeeJob || '').toLowerCase()

    const isFrontOffice = dept.includes('front') || dept.includes('office') || job.includes('guest') || job.includes('concierge') || job.includes('reception')
    const isKitchen = dept.includes('kitchen') || dept.includes('culinary') || job.includes('cook') || job.includes('chef')
    const isHousekeeping = dept.includes('housekeep') || job.includes('room') || job.includes('linen')
    const isFB = dept.includes('beverage') || dept.includes('f&b') || dept.includes('restaurant') || job.includes('waiter') || job.includes('bar')

    return lmResources.filter(r => {
      const title = (r.title || '').trim()
      const titleLower = title.toLowerCase()
      const descLower = (r.description || '').toLowerCase()
      const catLower = (r.category || '').toLowerCase()
      const comps = (Array.isArray(r.competencies) ? r.competencies : []).map(c => c.toLowerCase())
      const allText = `${titleLower} ${descLower} ${catLower} ${comps.join(' ')}`

      if (isFrontOffice) {
        // Must NOT match Kitchen or Housekeeping or Engineering topics
        if (
          titleLower.includes('kitchen') ||
          titleLower.includes('hygiene') ||
          titleLower.includes('haccp') ||
          titleLower.includes('culinary') ||
          titleLower.includes('food safety') ||
          titleLower.includes('engineering') ||
          titleLower.includes('maintenance') ||
          titleLower.includes('housekeep') ||
          titleLower.includes('room standard') ||
          titleLower.includes('linen') ||
          catLower.includes('food safety') ||
          catLower.includes('kitchen') ||
          catLower.includes('engineering') ||
          catLower.includes('housekeeping')
        ) {
          return false
        }
        // Must match Front Office / Guest Service / Communication / Leadership / Customer Service
        return (
          FRONT_OFFICE_COURSES.some(fc => title.toLowerCase().includes(fc.toLowerCase())) ||
          catLower.includes('customer service') ||
          catLower.includes('communication') ||
          catLower.includes('guest') ||
          catLower.includes('front office') ||
          comps.some(c => c.includes('customer') || c.includes('service') || c.includes('communication') || c.includes('front') || c.includes('guest') || c.includes('conflict') || c.includes('reservation'))
        )
      }

      if (isKitchen) {
        if (
          titleLower.includes('front desk') ||
          titleLower.includes('room standard') ||
          titleLower.includes('engineering') ||
          titleLower.includes('housekeep')
        ) {
          return false
        }
        return (
          KITCHEN_COURSES.some(kc => title.toLowerCase().includes(kc.toLowerCase())) ||
          catLower.includes('food safety') ||
          catLower.includes('kitchen') ||
          comps.some(c => c.includes('kitchen') || c.includes('haccp') || c.includes('food') || c.includes('recipe') || c.includes('culinary'))
        )
      }

      if (isHousekeeping) {
        if (
          titleLower.includes('kitchen') ||
          titleLower.includes('culinary') ||
          titleLower.includes('food safety') ||
          titleLower.includes('engineering') ||
          titleLower.includes('front desk')
        ) {
          return false
        }
        return (
          HOUSEKEEPING_COURSES.some(hc => title.toLowerCase().includes(hc.toLowerCase())) ||
          catLower.includes('housekeeping') ||
          comps.some(c => c.includes('housekeeping') || c.includes('room') || c.includes('linen') || c.includes('cleanliness'))
        )
      }

      if (isFB) {
        if (
          titleLower.includes('engineering') ||
          titleLower.includes('housekeep') ||
          titleLower.includes('room standard')
        ) {
          return false
        }
        return (
          FB_COURSES.some(fbc => title.toLowerCase().includes(fbc.toLowerCase())) ||
          catLower.includes('beverage') ||
          catLower.includes('service') ||
          catLower.includes('customer')
        )
      }

      // Default: do not show Kitchen, Housekeeping, or Engineering courses to general users
      return !(
        titleLower.includes('kitchen') ||
        titleLower.includes('haccp') ||
        titleLower.includes('engineering') ||
        titleLower.includes('housekeep')
      )
    })
  }, [lmResources, employeeDept, employeeJob])

  const categories = [...new Set(departmentFilteredResources.map(r => r.category).filter(Boolean))]

  const filtered = departmentFilteredResources.filter(r => {
    const q = searchQ.toLowerCase()
    const matchQ = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    const matchCat = !catFilter || r.category === catFilter
    return matchQ && matchCat
  })

  const link = (resource) => {
    if (linkedIds.has(resource.id)) return
    onChange([...value, {
      id: resource.id,
      name: resource.title,
      type: resource.provider_type === 'video' ? 'Video' : resource.provider_type === 'pdf' ? 'PDF' : 'Link',
      url: resource.url || '',
      category: resource.category,
      duration: resource.duration_hours,
      description: resource.description,
    }])
    setNotice(`"${resource.title}" linked to this competency plan.`)
    setTimeout(() => setNotice(''), 3000)
  }

  const unlink = (id) => onChange(value.filter(r => r.id !== id))

  return (
    <div className="builder lm-resources-builder">

      {/* Linked Resources Summary */}
      {value.length > 0 && (
        <div className="lm-linked-summary">
          <div className="lm-linked-summary-title">
            <Sparkles size={13} />
            <span>{value.length} Learning Resource{value.length !== 1 ? 's' : ''} Linked to Plan</span>
          </div>
          <div className="lm-linked-tags-wrap">
            {value.map((r, i) => (
              <span key={r.id || i} className="lm-linked-tag">
                {r.name}
                <button type="button" className="lm-unlink-btn" onClick={() => unlink(r.id)} aria-label="Unlink">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {notice && <div className="assigned-success-notice">{notice}</div>}

      {/* Role & Department Context Notice */}
      {employeeDept && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(17,24,39,0.05)', borderRadius: 8, border: '1px solid rgba(17,24,39,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={13} />
            <span>Showing modules relevant to <b>{employeeName}</b> ({employeeJob || 'Staff'} · {employeeDept})</span>
          </div>
          <small style={{ fontSize: 10, color: '#111827', fontWeight: 600 }}>Strict Department &amp; Role Filter Active</small>
        </div>
      )}

      {/* Filter Bar */}
      <div className="lm-filter-bar">
        <div className="lm-filter-input-wrap">
          <Search size={13} className="lm-filter-icon" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search learning resources…"
            className="lm-filter-input"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="lm-filter-select"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Resource Cards from Learning Management */}
      {loading ? (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '20px 0' }}>Loading learning resources…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '20px 0' }}>No resources found. Add resources in Learning Management first.</p>
      ) : (
        <div className="lm-resources-grid">
          {filtered.map(resource => {
            const isLinked = linkedIds.has(resource.id)
            return (
              <div
                key={resource.id}
                className={`lm-resource-card ${isLinked ? 'linked' : ''}`}
              >
                <div className="lm-card-head">
                  <span className="lm-card-category">
                    {resource.category || 'General'}
                  </span>
                  {resource.duration_hours && (
                    <span className="lm-card-duration">
                      <Clock size={11} /> {resource.duration_hours}h
                    </span>
                  )}
                </div>
                <h5 className="lm-card-title">{resource.title}</h5>
                {resource.description && (
                  <p className="lm-card-desc">
                    {resource.description}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isLinked}
                  onClick={() => link(resource)}
                  className={`lm-link-btn ${isLinked ? 'linked' : ''}`}
                >
                  {isLinked ? (
                    <><CheckCircle size={13} /> Linked to Plan</>
                  ) : (
                    <><Zap size={13} /> + Link to Plan</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------------------------- Builder: Assign employees -----------------------

function AssignEmployeesBuilder({ value = [], onChange, people = [] }) {
  const toggle = name => onChange(value.includes(name) ? value.filter(n => n !== name) : [...value, name])
  return (
    <div className="builder assign-builder">
      <div className="builder-note">Select employees to assign.</div>
      <div className="assign-list">
        {people.map(p => (
          <label key={p.id} className={value.includes(p.full_name) ? 'selected' : ''}>
            <input type="checkbox" checked={value.includes(p.full_name)} onChange={() => toggle(p.full_name)} />
            <span>{p.full_name} — {p.department}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ------------------------- Builder: Training Invite -----------------------

function TrainingInviteBuilder({ value = {}, onChange, people = [] }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  useEffect(() => {
    let mounted = true
    api.trainingSessions()
      .then(res => {
        if (mounted) setSessions(res.sessions || [])
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const selectedSessionId = value.sessionId || ''
  const selectedEmpIds = Array.isArray(value.employeeIds) ? value.employeeIds : []

  const handleSessionChange = sessionId => {
    const sess = sessions.find(s => s.id === sessionId) || null
    onChange({
      ...value,
      sessionId,
      sessionTitle: sess?.title || '',
      venue: sess?.venue || '',
      startDate: sess?.start_date || '',
    })
  }

  const toggleEmp = emp => {
    const isSelected = selectedEmpIds.includes(emp.id)
    const nextIds = isSelected ? selectedEmpIds.filter(id => id !== emp.id) : [...selectedEmpIds, emp.id]
    const nextNames = people.filter(p => nextIds.includes(p.id)).map(p => p.full_name)
    onChange({
      ...value,
      employeeIds: nextIds,
      employeeNames: nextNames,
    })
  }

  const selectedSess = sessions.find(s => s.id === selectedSessionId)

  const filteredEmployees = people.filter(p => {
    if (deptFilter && p.department !== deptFilter) return false
    if (search && !`${p.full_name} ${p.department} ${p.job_title || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const departments = [...new Set(people.map(p => p.department))].filter(Boolean)

  return (
    <div className="builder training-invite-builder" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="builder-note">
        Select a scheduled training session and multi-select employees to invite.
      </div>

      {/* 1. Session Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
          Select Scheduled Training Session *
        </label>
        <select
          value={selectedSessionId}
          onChange={e => handleSessionChange(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        >
          <option value="">Choose a Training Session…</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.title} — {String(s.start_date).slice(0, 10)} @ {s.venue} ({s.registered_count || 0}/{s.capacity} enrolled)
            </option>
          ))}
        </select>
        {sessions.length === 0 && !loading && (
          <small style={{ color: '#b91c1c' }}>No scheduled training sessions found in database. Create a session first in the Training Sessions Catalog.</small>
        )}
      </div>

      {/* Session Preview Badge */}
      {selectedSess && (
        <div style={{ background: '#f3f4f6', border: '1px solid #d5cefc', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <b style={{ color: '#111827', fontSize: 14 }}>{selectedSess.title}</b>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {selectedSess.venue}</span> • <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {String(selectedSess.start_date).slice(0, 10)}</span> • <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {selectedSess.registered_count || 0}/{selectedSess.capacity} capacity</span>
            </div>
          </div>
          <span style={{ background: '#111827', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{selectedSess.category}</span>
        </div>
      )}

      {/* 2. Employee Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
            Select Employees to Invite ({selectedEmpIds.length} selected) *
          </label>
          {filteredEmployees.length > 0 && (
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: '#111827', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => {
                const allIds = filteredEmployees.map(p => p.id)
                const nextIds = [...new Set([...selectedEmpIds, ...allIds])]
                const nextNames = people.filter(p => nextIds.includes(p.id)).map(p => p.full_name)
                onChange({ ...value, employeeIds: nextIds, employeeNames: nextNames })
              }}
            >
              + Select All Filtered ({filteredEmployees.length})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search employee name or job title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredEmployees.map(p => {
            const checked = selectedEmpIds.includes(p.id)
            return (
              <label
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: checked ? '#f3f4f6' : '#ffffff',
                  border: checked ? '1px solid #c4b8f3' : '1px solid #f3f4f6',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEmp(p)}
                />
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13, color: '#111827' }}>{p.full_name}</b>
                  <small style={{ display: 'block', color: '#6b7280', fontSize: 11 }}>
                    {p.job_title ? `${p.job_title} — ` : ''}{p.department}
                  </small>
                </div>
              </label>
            )
          })}
          {filteredEmployees.length === 0 && (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: 12, fontSize: 13, margin: 0 }}>No employees match your search criteria.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------- Builder: Progress tracker -----------------------

// ------------------------- Builder: Progress tracker -----------------------

function ProgressBuilder({ value = [], onChange, role, people = [], subject, events = [] }) {
  const [dbAssignments, setDbAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [notice, setNotice] = useState('')

  const subjectEmp = subject || (Array.isArray(people) && people.length > 0 ? people[0] : null)
  const employeeId = subjectEmp?.id || subjectEmp?.employee_id
  const subjectName = subjectEmp?.full_name || 'Employee'
  const isEmployee = role === 'employee'

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.learningAssignments()
      const list = res.assignments || []
      const filtered = employeeId ? list.filter(a => a.employee_id === employeeId) : list
      setDbAssignments(filtered)
      if (filtered.length > 0 && (!value || !value.length)) {
        onChange(filtered.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      }
    } catch {
      // Fallback to value prop if API fails
    } finally {
      setLoading(false)
    }
  }, [employeeId, onChange, value])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  const handleUpdateProgress = async (assignment, newProgress) => {
    setUpdatingId(assignment.id)
    try {
      await api.updateLearningProgress(assignment.id, newProgress)
      const updated = dbAssignments.map(a => a.id === assignment.id ? { ...a, progress: newProgress, status: newProgress >= 100 ? 'completed' : newProgress > 0 ? 'studying' : a.status } : a)
      setDbAssignments(updated)
      onChange(updated.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      setNotice(`Updated progress for "${assignment.resource_title}" to ${newProgress}%.`)
    } catch (err) {
      setNotice(`Failed to update progress: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateStatus = async (assignment, newStatus) => {
    setUpdatingId(assignment.id)
    try {
      await api.updateLearningStatus(assignment.id, newStatus)
      const updated = dbAssignments.map(a => a.id === assignment.id ? { ...a, status: newStatus } : a)
      setDbAssignments(updated)
      onChange(updated.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      setNotice(`Updated status for "${assignment.resource_title}" to ${newStatus.replace('_', ' ')}.`)
    } catch (err) {
      setNotice(`Failed to update status: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="builder progress-builder" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {notice && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700 }}>
            {isEmployee ? 'My Assigned Development Plans & Learning Paths' : `Assigned Learning Progress for ${subjectName}`}
          </h4>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {isEmployee ? 'Track your study progress and update your completion status.' : 'Review learner completion against assigned competency development plans.'}
          </span>
        </div>
        {loading && <small style={{ color: '#4b5563', fontSize: 11 }}>Syncing progress…</small>}
      </div>

      {/* Real database assignments list */}
      {dbAssignments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dbAssignments.map(a => (
            <div
              key={a.id}
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--border, #e5e3ee)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b style={{ fontSize: 12.5, color: 'inherit' }}>{a.resource_title}</b>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: 'rgba(17, 24, 39, 0.1)', color: '#111827' }}>
                      {a.category || 'Skill Development'}
                    </span>
                    {a.duration_hours && (
                      <span style={{ fontSize: 10, color: '#64748b' }}>· {a.duration_hours} hrs</span>
                    )}
                    {(a.competencies || []).map(c => (
                      <span key={c} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                        ✦ Closes gap in {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={a.status || 'not_started'}
                    onChange={e => handleUpdateStatus(a, e.target.value)}
                    disabled={updatingId === a.id}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: 'inherit',
                      color: 'inherit',
                      cursor: updatingId === a.id ? 'wait' : 'pointer',
                    }}
                  >
                    <option value="not_started">Not started</option>
                    <option value="studying">Studying</option>
                    <option value="completed">Completed</option>
                    <option value="need_help">Need help</option>
                  </select>
                  {a.is_completed && (Number(a.progress) >= 100 || a.status === 'completed') && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#d1fae5', color: '#065f46' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Slider & Interactive Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={e => {
                    if (updatingId === a.id) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
                    handleUpdateProgress(a, pct)
                  }}
                  title="Click anywhere on the bar to set progress"
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 5,
                    background: 'rgba(148,163,184,0.2)',
                    overflow: 'hidden',
                    cursor: updatingId === a.id ? 'wait' : 'pointer',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${a.progress || 0}%`,
                      background: Number(a.progress) >= 100 ? '#10b981' : 'linear-gradient(90deg, #4b5563, #111827)',
                      borderRadius: 5,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <b style={{ fontSize: 11.5, minWidth: 42, textAlign: 'right' }}>{Math.round(Number(a.progress || 0))}%</b>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(Number(a.progress || 0))}
                  disabled={updatingId === a.id}
                  onChange={e => handleUpdateProgress(a, Number(e.target.value))}
                  style={{ width: 110, cursor: updatingId === a.id ? 'wait' : 'pointer' }}
                />
              </div>

              {/* Quick Set Buttons */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <small style={{ fontSize: 10, color: '#64748b' }}>Quick set:</small>
                {[0, 25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    disabled={updatingId === a.id}
                    onClick={() => handleUpdateProgress(a, pct)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: Math.round(Number(a.progress || 0)) === pct ? 700 : 500,
                      borderRadius: 4,
                      border: Math.round(Number(a.progress || 0)) === pct ? '1px solid #111827' : '1px solid #cbd5e1',
                      background: Math.round(Number(a.progress || 0)) === pct ? '#f3f4f6' : '#ffffff',
                      color: Math.round(Number(a.progress || 0)) === pct ? '#111827' : '#475569',
                      cursor: updatingId === a.id ? 'wait' : 'pointer',
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(17, 24, 39, 0.04)', border: '1px dashed rgba(17, 24, 39, 0.2)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 600, color: 'inherit' }}>
            No development courses assigned yet.
          </p>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            HR and supervisors assign development plans and courses in the <b>Assign development plan</b> step.
          </small>
        </div>
      )}
    </div>
  )
}

// ------------------------- Builder: Attendance -----------------------------

function AttendanceBuilder({ value = [], onChange }) {
  const toggle = (index, present) => {
    const next = [...value]
    next[index] = { ...next[index], present }
    onChange(next)
  }
  return (
    <div className="builder attendance-builder">
      <div className="builder-note">Record which participants attended.</div>
      {value.map((row, index) => (
        <div className="attendance-row" key={index}>
          <span>{row.name || `Participant ${index + 1}`}</span>
          <div className="attendance-controls">
            <button type="button" className={row.present ? 'active' : ''} onClick={() => toggle(index, true)}>Present</button>
            <button type="button" className={row.present === false ? 'absent' : ''} onClick={() => toggle(index, false)}>Absent</button>
          </div>
        </div>
      ))}
      {!value.length && <p className="empty-hint">Invite participants first to record attendance.</p>}
    </div>
  )
}

// ------------------------- Builder: Talent pool ----------------------------

function TalentPoolBuilder({ value = [], onChange }) {
  // value = array of {name, role, readiness} selections
  const toggle = index => onChange(value.map((p, i) => i === index ? { ...p, selected: !p.selected } : p))
  return (
    <div className="builder talent-builder">
      <div className="builder-note">Select candidates for the critical position.</div>
      {value.map((p, index) => (
        <label key={index} className={p.selected ? 'selected' : ''}>
          <input type="checkbox" checked={Boolean(p.selected)} onChange={() => toggle(index)} />
          <span>{p.name} — {p.role || ''}</span>
          {p.readiness ? <em>{p.readiness}</em> : null}
        </label>
      ))}
      {!value.length && <p className="empty-hint">No talent pool records yet.</p>}
    </div>
  )
}

// ------------------------- Builder: Nomination -----------------------------

function NominationsBuilder({ value = [], onChange, people = [] }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { employee: '', rationale: '', targetRole: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder nominees-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>Candidate<select value={row.employee} onChange={e => set(index, { employee: e.target.value })}><option value="">Select…</option>{people.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}</select></label>
            <label>Target role<input value={row.targetRole} onChange={e => set(index, { targetRole: e.target.value })} placeholder="e.g. Department Head" /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete">×</button>
          </div>
          <label>Rationale<textarea value={row.rationale} onChange={e => set(index, { rationale: e.target.value })} rows={2} placeholder="Why this candidate?" /></label>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Nominate candidate</button>
    </div>
  )
}

// ------------------------- Builder: Succession Review -----------------------

function SuccessionReviewBuilder({ value = {}, onChange, people = [], subject, workflow, role, formConfig, events = [] }) {
  // Determine current subject employee
  const currentEmployee = useMemo(() => {
    if (subject?.id) return subject
    if (workflow?.subject_employee_id) {
      const found = people.find(p => p.id === workflow.subject_employee_id)
      if (found) return found
    }
    if (value.employee) {
      const found = people.find(p => p.full_name === value.employee || p.id === value.employeeId)
      if (found) return found
    }
    return people[0] || null
  }, [subject, workflow, value.employee, value.employeeId, people])

  const targetEmpId = currentEmployee?.id || workflow?.subject_employee_id

  // Check if current user is the subject employee
  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}').employeeId
    } catch {
      return null
    }
  })()
  const isSelf = Boolean(currentUserId && targetEmpId && currentUserId === targetEmpId)

  // Identify workflow step: Stage 2 (nominate), Stage 3 (review_readiness), Stage 4 (approved)
  const currentStage = workflow?.current_stage || (formConfig?.builder === 'successionAssessment' ? 'nominate' : formConfig?.builder === 'successionApproval' ? 'approved' : 'review_readiness')
  const isNominationStep = currentStage === 'nominate' || formConfig?.builder === 'successionAssessment'
  const isApprovalStep = currentStage === 'approved' || formConfig?.builder === 'successionApproval'
  const isReviewStep = !isNominationStep && !isApprovalStep

  // Extract prior nomination proposal from Stage 2 if available
  const nominationEvent = useMemo(() => {
    return (events || []).find(e => e.stage === 'nominate') || null
  }, [events])
  const nominationData = nominationEvent?.details || workflow?.metadata?.nomination || null

  // Use cached assessment if available from previous steps or metadata — NEVER auto-call AI on refresh
  const cachedAssessment = useMemo(() => {
    return value?.assessment || workflow?.metadata?.assessment || nominationData?.assessment || null
  }, [value?.assessment, workflow?.metadata?.assessment, nominationData?.assessment])

  const [assessment, setAssessment] = useState(cachedAssessment)
  const [analyzing, setAnalyzing] = useState(false)
  const [positions, setPositions] = useState([])
  const [fetchError, setFetchError] = useState('')

  // Sync state if cachedAssessment appears from workflow props
  useEffect(() => {
    if (cachedAssessment && !assessment) {
      setAssessment(cachedAssessment)
    }
  }, [cachedAssessment]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load database positions list only (fast, local SQL query, zero AI/LLM calls)
  useEffect(() => {
    let mounted = true
    api.successionPositions().then(posRes => {
      if (!mounted) return
      const list = posRes.positions || []
      setPositions(list)
      const defaultTarget = value.targetPosition || cachedAssessment?.recommendedPosition || nominationData?.targetPosition || (list[0]?.title || '')
      if (!value.targetPosition) {
        onChange({
          ...value,
          targetPosition: defaultTarget,
          timeline: value.timeline || nominationData?.timeline || 'Ready Now',
          decision: isNominationStep ? 'nominate' : (value.decision || 'approve'),
          effectiveDate: value.effectiveDate || nominationData?.effectiveDate || new Date().toISOString().slice(0, 10),
        })
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [targetEmpId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ON-DEMAND AI ANALYSIS: Only triggered when user explicitly clicks "Run AI Succession Analysis" in Step 2
  const runAiAnalysis = async () => {
    if (!targetEmpId || analyzing) return
    setAnalyzing(true)
    setFetchError('')
    try {
      const res = await api.successionAssess(targetEmpId)
      if (res.error) {
        setFetchError(res.error)
        return
      }
      const assessData = res.assessment || null
      setAssessment(assessData)
      if (assessData) {
        const defaultTarget = value.targetPosition || assessData.recommendedPosition || (positions[0]?.title || '')
        onChange({
          ...value,
          assessment: assessData,
          employeeId: targetEmpId,
          employee: currentEmployee?.full_name || '',
          targetPosition: defaultTarget,
          readinessScore: assessData.readinessScore,
          readinessBand: assessData.readinessBand,
          recommendedPosition: assessData.recommendedPosition,
          recommendationReason: assessData.recommendationReason,
        })
      }
    } catch (err) {
      setFetchError(err.message || 'Unable to generate AI assessment.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Deterministic readiness score calculated instantly with 0 delay and zero AI calls
  const deterministicScore = currentEmployee?.readiness_score ?? Math.round(
    (currentEmployee?.performance_score || 0) * 0.5 +
    (currentEmployee?.competency_score || 0) * 0.3 +
    (currentEmployee?.learning_progress || 0) * 0.2
  )
  const readinessScore = assessment?.readinessScore ?? deterministicScore
  const readinessBand = assessment?.readinessBand ?? (
    readinessScore >= 85 ? 'ready_now' : readinessScore >= 70 ? 'ready_in_1_2_years' : 'development_needed'
  )
  const bandLabel = readinessBand === 'ready_now'
    ? 'Ready Now (Immediate)'
    : readinessBand === 'ready_in_1_2_years'
    ? 'Ready in 1–2 Years'
    : 'Development Needed'

  const bandColor = readinessBand === 'ready_now'
    ? '#10b981'
    : readinessBand === 'ready_in_1_2_years'
    ? '#3b82f6'
    : '#f59e0b'

  return (
    <div className="builder succession-review-builder srb-root">
      {/* 1. Candidate Overview & Deterministic Readiness */}
      <div className="srb-candidate-card">
        <div>
          <div className="srb-candidate-name-row">
            <span className="srb-candidate-name">
              {currentEmployee?.full_name || 'Selected Candidate'}
            </span>
            <span className="srb-candidate-badge">
              {currentEmployee?.employee_number || 'ID'}
            </span>
          </div>
          <div className="srb-candidate-meta">
            Current Position: <strong>{currentEmployee?.job_title || 'Staff'}</strong> · Department: <strong>{currentEmployee?.department || 'Department'}</strong>
          </div>
        </div>

        {/* Deterministic Readiness Gauge */}
        <div className="srb-readiness-gauge-wrap">
          <div className="srb-readiness-ring" style={{ borderColor: bandColor, background: `${bandColor}18` }}>
            <span className="srb-readiness-score" style={{ color: bandColor }}>
              {readinessScore}%
            </span>
            <small className="srb-readiness-label" style={{ color: bandColor }}>Score</small>
          </div>
          <div>
            <div className="srb-readiness-eyebrow">Official Readiness</div>
            <div className="srb-readiness-band" style={{ color: bandColor }}>{bandLabel}</div>
            <div className="srb-readiness-formula">Formula: 50% Perf + 30% Comp + 20% Learn</div>
          </div>
        </div>
      </div>

      {/* Insufficient Data Warning if applicable */}
      {assessment?.sufficientData === false && (
        <div className="srb-insufficient-box">
          <div className="srb-insufficient-title">
            <AlertTriangle size={15} /> Insufficient Data Notice
          </div>
          <p className="srb-insufficient-msg">{assessment.message}</p>
          {assessment.missingInformation?.length > 0 && (
            <div className="srb-insufficient-detail">
              Missing evidence: <strong>{assessment.missingInformation.join(', ')}</strong>
            </div>
          )}
        </div>
      )}

      {/* 2. AI Next Position & Critical Role Recommendation / On-Demand Analyzer */}
      {analyzing ? (
        <div className="srb-loading">
          <Sparkles size={24} className="srb-loading-icon" />
          <p className="srb-loading-title">Analyzing candidate capability data &amp; generating AI succession assessment…</p>
          <small className="srb-loading-sub">Evaluating performance, competencies, and available system positions via AI</small>
        </div>
      ) : assessment ? (
        <div className="srb-ai-card">
          <div className="srb-ai-card-header">
            <div className="srb-ai-card-title">
              <Sparkles size={16} /> Recommended Next Position / Critical Role
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="srb-ai-badge">AI-Assisted &amp; Grounded</span>
              {isNominationStep && (
                <button
                  type="button"
                  onClick={runAiAnalysis}
                  disabled={analyzing || isSelf}
                  style={{ fontSize: 11, background: 'transparent', border: '1px solid rgba(17, 24, 39, 0.3)', color: '#111827', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                  title="Re-run AI analysis if employee data changed"
                >
                  ↻ Re-analyze with AI
                </button>
              )}
            </div>
          </div>

          <div className="srb-position-highlight">
            <div className="srb-position-title">
              {assessment?.recommendedPosition || 'Senior Role'}
            </div>
            <p className="srb-position-reason">
              {assessment?.recommendationReason}
            </p>
          </div>

          {/* AI Readiness Assessment Overview */}
          {assessment?.readinessAssessment && (
            <div className="srb-summary-box">
              <strong className="srb-summary-label">Assessment Summary: </strong>
              {assessment.readinessAssessment}
            </div>
          )}

          {/* Competency Matches vs Gaps Grid */}
          <div className="srb-comp-grid">
            <div className="srb-comp-matching">
              <div className="srb-comp-heading srb-comp-heading--green">
                <Check size={13} /> Matching Competencies
              </div>
              <ul className="srb-comp-list srb-comp-list--green">
                {(assessment?.matchingCompetencies || []).length > 0
                  ? assessment.matchingCompetencies.map((m, i) => <li key={i}>{m}</li>)
                  : <li>Baseline core service standards met.</li>}
              </ul>
            </div>
            <div className="srb-comp-gaps">
              <div className="srb-comp-heading srb-comp-heading--amber">
                <AlertTriangle size={13} /> Competency Gaps
              </div>
              <ul className="srb-comp-list srb-comp-list--amber">
                {(assessment?.missingCompetencies || []).length > 0
                  ? assessment.missingCompetencies.map((m, i) => <li key={i}>{m}</li>)
                  : <li>No major critical skill gaps detected.</li>}
              </ul>
            </div>
          </div>

          {/* Recommended Development Actions */}
          {assessment?.developmentRecommendations?.length > 0 && (
            <div className="srb-dev-actions">
              <div className="srb-dev-actions-title">Recommended Development Actions:</div>
              <ul className="srb-dev-actions-list">
                {assessment.developmentRecommendations.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* If assessment not yet generated: Show on-demand analysis action box */
        <div className="srb-ai-card" style={{ textAlign: 'center', padding: '24px 20px', borderStyle: 'dashed' }}>
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'rgba(17, 24, 39, 0.1)', color: '#111827', marginBottom: 10 }}>
            <Sparkles size={24} />
          </div>
          <div className="srb-review-heading" style={{ fontSize: 14, marginBottom: 4 }}>
            AI Capability &amp; Role Recommendation
          </div>
          <p style={{ margin: '0 auto 16px', maxWidth: 460, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Analyze <strong>{currentEmployee?.full_name}</strong>'s performance scores, core competency levels, and learning progress against hotel critical positions using AI.
          </p>
          <button
            type="button"
            disabled={analyzing || isSelf}
            onClick={runAiAnalysis}
            className="srb-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #111827 0%, #4b5563 100%)',
              color: '#ffffff',
              border: 0,
              cursor: isSelf ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 10px rgba(17, 24, 39, 0.25)',
            }}
          >
            <Sparkles size={15} />
            Run AI Succession Analysis
          </button>
          {fetchError && (
            <div style={{ marginTop: 10, color: '#dc2626', fontSize: 11.5 }}>
              ⚠ {fetchError}
            </div>
          )}
        </div>
      )}

      {/* Stage 2: Candidate Nomination & Proposal Form */}
      {isNominationStep && (
        <div className="srb-review-card srb-nomination-card">
          <div className="srb-review-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Stage 2: Candidate Nomination &amp; Proposal</span>
            <span style={{ fontSize: 11, background: '#f3f4f6', color: '#111827', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
              Nominator Form
            </span>
          </div>
          <small className="srb-review-sub">
            Review the AI evaluation and capability profile above. Specify the proposed target position and document the business rationale for nominating this candidate into the succession pipeline.
          </small>

          {isSelf && (
            <div className="srb-self-warning">
              ⚠ You are viewing your own assessment. System policy prohibits employees from submitting or approving their own succession nominations.
            </div>
          )}

          <div className="srb-fields-grid">
            <label className="srb-field-label">
              Proposed Target Position *
              <select
                value={value.targetPosition || ''}
                onChange={e => onChange({ ...value, targetPosition: e.target.value })}
                disabled={isSelf}
                className="srb-select"
              >
                <option value="">Select target system position…</option>
                {positions.map(p => (
                  <option key={p.id} value={p.title}>
                    {p.title} ({p.department}){p.is_critical ? ' ★ Critical' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="srb-field-label">
              Target Readiness Timeline *
              <select
                value={value.timeline || 'Ready Now'}
                onChange={e => onChange({ ...value, timeline: e.target.value })}
                disabled={isSelf}
                className="srb-select"
              >
                <option value="Ready Now">Ready Now (Immediate)</option>
                <option value="Ready in 1–2 Years">Ready in 1–2 Years</option>
                <option value="Development Needed">Development Needed (Long-term Track)</option>
              </select>
            </label>
          </div>

          <label className="srb-field-label">
            Nomination Rationale &amp; Endorsement Notes *
            <textarea
              value={value.note || ''}
              onChange={e => onChange({ ...value, note: e.target.value })}
              placeholder="Explain why this candidate is nominated for this critical role, key strengths, leadership qualifications, or business justification..."
              rows={3}
              disabled={isSelf}
              className="srb-textarea"
            />
          </label>

          <div style={{ padding: '10px 14px', background: 'rgba(17, 24, 39, 0.06)', border: '1px solid rgba(17, 24, 39, 0.2)', borderRadius: 8, fontSize: 11.5, color: '#111827' }}>
            ℹ <strong>Next Step:</strong> Completing this step records the candidate's nomination and advances to <strong>Stage 3 (Review Readiness &amp; Decision)</strong> for Authorized Management &amp; HR Review.
          </div>
        </div>
      )}

      {/* Stage 3: Management Review & Succession Decision Controls */}
      {isReviewStep && (
        <>
          {/* Summary of Stage 2 Nomination Proposal if available */}
          {(nominationData || value.timeline) && (
            <div style={{ padding: '12px 16px', background: 'rgba(17, 24, 39, 0.05)', border: '1px solid rgba(17, 24, 39, 0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Stage 2 Nomination Submission
              </div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                Proposed Target: <strong>{nominationData?.targetPosition || value.targetPosition || 'Leadership Role'}</strong> · Proposed Timeline: <strong>{nominationData?.timeline || value.timeline || 'Ready Now'}</strong>
              </div>
              {(nominationData?.note || nominationEvent?.note) && (
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                  "{nominationData?.note || nominationEvent?.note}"
                </div>
              )}
            </div>
          )}

          <div className="srb-review-card">
            <div className="srb-review-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Stage 3: Management Review &amp; Succession Decision</span>
              <span style={{ fontSize: 11, background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                HR &amp; Management Authority
              </span>
            </div>
            <small className="srb-review-sub">
              AI recommendations are decision-support only and never automatically promote employees. Authorized management review and decision are required.
            </small>

            {isSelf && (
              <div className="srb-self-warning">
                ⚠ You are viewing your own succession assessment. System policy prohibits employees from approving their own succession or modifying succession recommendations.
              </div>
            )}

            <div className="srb-fields-grid">
              <label className="srb-field-label">
                Confirmed Target Position *
                <select
                  value={value.targetPosition || ''}
                  onChange={e => onChange({ ...value, targetPosition: e.target.value })}
                  disabled={isSelf}
                  className="srb-select"
                >
                  <option value="">Select target system position…</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.title}>
                      {p.title} ({p.department}){p.is_critical ? ' ★ Critical' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="srb-field-label">
                Effective Promotion Date *
                <input
                  type="date"
                  value={value.effectiveDate || new Date().toISOString().slice(0, 10)}
                  onChange={e => onChange({ ...value, effectiveDate: e.target.value })}
                  disabled={isSelf}
                  className="srb-input"
                />
              </label>
            </div>

            <label className="srb-field-label">
              Review Decision *
              <div className="srb-decision-row">
                {[
                  { key: 'approve', label: 'Approve Succession', color: '#10b981' },
                  { key: 'return', label: 'Return for Revision', color: '#f59e0b' },
                  { key: 'reject', label: 'Reject Nomination', color: '#ef4444' },
                ].map(d => {
                  const isActive = (value.decision || 'approve') === d.key
                  return (
                    <button
                      key={d.key}
                      type="button"
                      disabled={isSelf}
                      onClick={() => onChange({ ...value, decision: d.key })}
                      className={`srb-decision-btn srb-decision-btn--${d.key}${isActive ? ' srb-decision-btn--active' : ''}`}
                      aria-pressed={isActive}
                    >
                      <span className="srb-decision-indicator">
                        {isActive ? <Check size={13} strokeWidth={3} /> : <span className="srb-decision-dot" />}
                      </span>
                      <span>{d.label}</span>
                    </button>
                  )
                })}
              </div>
            </label>

            <label className="srb-field-label">
              Review Notes &amp; Justification
              <textarea
                value={value.note || ''}
                onChange={e => onChange({ ...value, note: e.target.value })}
                placeholder="Document manager or HR review notes, readiness rationale, or return/reject feedback..."
                rows={2}
                disabled={isSelf}
                className="srb-textarea"
              />
            </label>
          </div>
        </>
      )}

      {/* Stage 4: Approval Summary & Position Update Execution */}
      {isApprovalStep && (
        <div className="srb-review-card">
          <div className="srb-review-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Stage 4: Succession Approval &amp; Position Update</span>
            <span style={{ fontSize: 11, background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
              Ready for Execution
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#475569' }}>
            Candidate <strong>{currentEmployee?.full_name}</strong> is authorized for promotion to <strong>{value.targetPosition || assessment?.recommendedPosition}</strong>, effective <strong>{value.effectiveDate || new Date().toISOString().slice(0, 10)}</strong>.
          </p>
          <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 12, color: '#065f46' }}>
            ✓ <strong>13-Step Atomic Side Effects:</strong> Advancing this step updates the employee position, archives previous position history, records the succession decision, updates executive analytics, and sends notifications.
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------- Builder: Hybrid Competency Comparison (Approach A + C) ---
function CompetencyComparisonBuilder({ value = {}, onChange, workflow, subjectName, subjectEmployeeId, subject }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const targetWorkflowId = workflow?.id
  const empId = subjectEmployeeId || workflow?.subject_employee_id || subject?.id || subject?.employee_id || subject?.employeeId
  const displayName = subjectName || workflow?.subject_name || subject?.full_name || 'the employee'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const requestPromise = targetWorkflowId
      ? api.getCompetencyComparison(targetWorkflowId)
      : (empId && String(empId) !== 'undefined' && String(empId) !== 'null')
      ? api.getEmployeeCompetencyComparison(empId)
      : Promise.resolve(null)

    requestPromise
      .then(res => {
        if (active && res?.comparison) {
          setData(res.comparison)
          if (!value.newScore && res.comparison.aiRecommended?.score) {
            onChange({
              ...value,
              newScore: res.comparison.aiRecommended.score,
              selectedApproach: 'ai',
              reviewNotes: value.reviewNotes || `Calibrated using AI Recommended Score (${res.comparison.aiRecommended.score}%).`
            })
          }
        }
      })
      .catch(err => {
        // Silently retain empirical & fallback AI calculation defaults without blocking HR review
        if (active) console.warn('[PDS COMPARING COMPETENCY] Comparison endpoint info:', err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
  }, [targetWorkflowId, empId])

  const handleSelectScore = (score, approach, sourceLabel) => {
    onChange({
      ...value,
      newScore: score,
      selectedApproach: approach,
      reviewNotes: value.reviewNotes || `Score set via ${sourceLabel} (${score}%).`
    })
  }

  const currentScore = value.newScore !== undefined ? value.newScore : (data?.aiRecommended?.score || 85)
  const selectedApproach = value.selectedApproach || 'ai'

  return (
    <div className="builder competency-comparison-builder" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'inherit' }}>
            Competency Score Calibration & AI Comparison Panel
          </h4>
          <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>
            Compare actual empirical course completion auto-lift vs. AI multi-metric recommendation for {displayName}.
          </p>
        </div>
        {loading && <small style={{ color: '#64748b', fontSize: 11 }}>Calculating metrics…</small>}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Side-by-Side Cards (Approach A vs Approach C) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14 }}>
        {/* Approach A: Auto-Lift Card */}
        <div
          style={{
            background: selectedApproach === 'autolift' ? 'rgba(16,185,129,0.04)' : 'var(--card-bg, #ffffff)',
            border: selectedApproach === 'autolift' ? '2px solid #10b981' : '1.5px solid var(--border, #e2e8f0)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            boxShadow: selectedApproach === 'autolift' ? '0 4px 12px rgba(16,185,129,0.15)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#047857' }}>
              ⚡ Approach A: Actual Auto-Lift
            </span>
            <b style={{ fontSize: 22, fontWeight: 800, color: '#047857' }}>
              {data ? `${data.autoLift.score}%` : '85%'}
            </b>
          </div>

          <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>
            <strong>Basis:</strong> Verified course completions & baseline progress
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#64748b' }}>
              <li>Baseline score: {data ? `${data.autoLift.baseScore}%` : '75%'}</li>
              <li>Completed courses: <strong>{data ? data.autoLift.completedCoursesCount : 2} course(s)</strong></li>
              {data?.autoLift?.completedCourses?.map((c, i) => (
                <li key={i} style={{ color: '#059669', fontWeight: 600 }}>✓ {c}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handleSelectScore(data ? data.autoLift.score : 85, 'autolift', 'Approach A (Auto-Lift)')}
            style={{
              marginTop: 'auto',
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: selectedApproach === 'autolift' ? '#10b981' : 'rgba(16,185,129,0.1)',
              color: selectedApproach === 'autolift' ? '#ffffff' : '#047857',
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {selectedApproach === 'autolift' ? '✓ Auto-Lift Score Selected' : `Use Auto-Lift (${data ? data.autoLift.score : 85}%)`}
          </button>
        </div>

        {/* Approach C: AI Recommendation Card */}
        <div
          style={{
            background: selectedApproach === 'ai' ? 'rgba(99,102,241,0.04)' : 'var(--card-bg, #ffffff)',
            border: selectedApproach === 'ai' ? '2px solid #6366f1' : '1.5px solid var(--border, #e2e8f0)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            boxShadow: selectedApproach === 'ai' ? '0 4px 12px rgba(99,102,241,0.15)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: '#4338ca' }}>
              🤖 Approach C: AI Recommendation
            </span>
            <b style={{ fontSize: 22, fontWeight: 800, color: '#4338ca' }}>
              {data ? `${data.aiRecommended.score}%` : '88%'}
            </b>
          </div>

          <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>
            <strong>Basis:</strong> Multi-metric AI synthesis & role benchmark
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#64748b' }}>
              <li>Performance KPI score: <strong>{data ? `${data.aiRecommended.kpiScore}%` : '88%'}</strong></li>
              <li>Learning progress: <strong>{data ? `${data.aiRecommended.learningProgress}%` : '100%'}</strong></li>
              {data?.aiRecommended?.confidenceBoost > 0 && (
                <li style={{ color: '#4338ca', fontWeight: 600 }}>✦ +{data.aiRecommended.confidenceBoost}% AI confidence boost</li>
              )}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handleSelectScore(data ? data.aiRecommended.score : 88, 'ai', 'Approach C (AI Recommendation)')}
            style={{
              marginTop: 'auto',
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: selectedApproach === 'ai' ? '#6366f1' : 'rgba(99,102,241,0.1)',
              color: selectedApproach === 'ai' ? '#ffffff' : '#4338ca',
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {selectedApproach === 'ai' ? '✓ AI Recommendation Selected' : `Use AI Recommendation (${data ? data.aiRecommended.score : 88}%)`}
          </button>
        </div>
      </div>

      {/* Variance Analysis Box */}
      {data && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--card-bg, #ffffff)',
            border: '1.5px dashed var(--border, #cbd5e1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: data.variance > 0 ? '#dbeafe' : '#f1f5f9', color: data.variance > 0 ? '#1e40af' : '#475569' }}>
              📊 Variance Analysis: {data.variance > 0 ? `+${data.variance}% AI Boost` : data.variance < 0 ? `${data.variance}% AI Adjustment` : 'Exact Match (0% Variance)'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>
            {data.reasoning}
          </p>
        </div>
      )}

      {/* Final Score Adjuster & Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4, padding: 14, borderRadius: 10, background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'inherit' }}>
            Final Calibrated Competency Score: <span style={{ color: '#0284c7', fontSize: 14 }}>{currentScore}%</span>
          </label>
          <small style={{ fontSize: 11, color: '#64748b' }}>Selected via {selectedApproach === 'ai' ? 'AI Recommendation' : selectedApproach === 'autolift' ? 'Auto-Lift' : 'Manual HR Adjustment'}</small>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={currentScore}
          onChange={e => handleSelectScore(Number(e.target.value), 'custom', 'Manual HR Input')}
          style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
        />

        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'inherit' }}>
            Record Calibration Notes
          </label>
          <textarea
            rows={2}
            value={value.reviewNotes || ''}
            onChange={e => onChange({ ...value, reviewNotes: e.target.value })}
            placeholder="Notes on the calibrated score or audit justification..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: 'inherit', color: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    </div>
  )
}

// ------------------------------- Form shell --------------------------------

const BUILDERS = {
  kpi: { Component: KpiBuilder, initial: () => [] },
  kpiLibrary: { Component: KpiLibraryBuilder, initial: () => [] },
  assessment: { Component: AssessmentBuilder, initial: role => ({ kpiRatings: [], averageRating: 4.0, overall: 80, strengths: '', improvements: '', comments: '', role: role || '' }) },
  calibration: { Component: CalibrationBuilder, initial: () => ({ decision: '', finalScore: '', reason: '' }) },
  competencyTemplate: { Component: CompetencyTemplateBuilder, initial: () => [] },
  skillGapPlan: { Component: SkillGapPlanBuilder, initial: () => ({ planTitle: 'Development Plan', prioritySkills: ['Customer Service'], coachingNotes: '' }) },
  competencyRequirement: { Component: CompetencyRequirementBuilder, initial: () => [] },
  competencyComparison: { Component: CompetencyComparisonBuilder, initial: () => ({ newScore: 85, selectedApproach: 'ai', reviewNotes: '' }) },
  resources: { Component: ResourcesBuilder, initial: () => [] },
  assignEmployees: { Component: AssignEmployeesBuilder, initial: () => [] },
  trainingInvite: { Component: TrainingInviteBuilder, initial: () => ({ sessionId: '', employeeIds: [] }) },
  progress: { Component: ProgressBuilder, initial: () => [] },
  attendance: { Component: AttendanceBuilder, initial: () => [] },
  talentPool: { Component: TalentPoolBuilder, initial: () => [] },
  nominations: { Component: NominationsBuilder, initial: () => [] },
  successionReview: { Component: SuccessionReviewBuilder, initial: () => ({ decision: 'approve', targetPosition: '', note: '' }) },
  successionAssessment: { Component: SuccessionReviewBuilder, initial: () => ({ targetPosition: '', timeline: 'Ready Now', note: '', decision: 'nominate' }) },
  successionApproval: { Component: SuccessionReviewBuilder, initial: () => ({ decision: 'approve', targetPosition: '', note: '' }) },
}

// Returns a fresh initial value for a step's form/builder so the workflow UI
// can seed the controlled form value when a stage becomes current. Returns
// undefined for plain field-only forms (their value starts as {}).
export function getInitialValue(formConfig, role) {
  if (!formConfig) return undefined
  if (formConfig.builder) {
    const builder = BUILDERS[formConfig.builder]
    return builder ? builder.initial(role) : {}
  }
  const fields = formConfig.fields || []
  if (fields.length === 0) return undefined
  return fields.reduce((acc, field) => {
    if (field.type === 'toggle') acc[field.name] = false
    else if (field.type === 'rating') acc[field.name] = 0
    else if (field.type === 'slider') acc[field.name] = field.min ?? 0
    else if (field.type === 'multiSelect' || field.type === 'checkboxgroup' || field.type === 'chips') acc[field.name] = []
    else if (field.type === 'commentSuggestions') acc[field.name] = ''
    else acc[field.name] = ''
    return acc
  }, {})
}

export default function WorkflowForms({ formConfig, value, onChange, role, people, suggestions = [], events = [], subject, workflow }) {
  const [error, setError] = useState('')
  const [section, setSection] = useState(0)

  const builder = formConfig?.builder ? BUILDERS[formConfig.builder] : null
  const fields = formConfig?.fields || []
  const progressive = formConfig?.progressive && !builder && fields.length > 0
  const visibleFields = progressive ? fields.filter(f => f.section === undefined || f.section === section) : fields

  const isRequiredFilled = useMemo(() => {
    if (!formConfig) return false
    if (builder) {
      if (Array.isArray(value)) return value.length > 0
      if (formConfig.builder === 'trainingInvite') {
        return Boolean(value?.sessionId && Array.isArray(value?.employeeIds) && value.employeeIds.length > 0)
      }
      if (formConfig.builder === 'calibration') {
        // Calibration requires a decision; finalScore when overriding; reason
        // when overriding or returning for reassessment.
        const decision = value?.decision || ''
        if (!decision) return false
        if (decision === 'Override Final Score' && (value?.finalScore === '' || value?.finalScore === undefined || value?.finalScore === null)) return false
        if ((decision === 'Override Final Score' || decision === 'Return for Reassessment') && !String(value?.reason || '').trim()) return false
        return true
      }
      return Boolean(value && Object.keys(value).length)
    }
    return (formConfig.fields || []).every(field => {
      if (!field.required) return true
      const v = value?.[field.name]
      if (Array.isArray(v)) return v.length > 0
      if (field.type === 'toggle') return Boolean(v)
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
  }, [builder, value, formConfig])

  const onSubmit = e => {
    e.preventDefault()
    if (!isRequiredFilled) {
      setError('Please complete all required fields before completing this step.')
      return
    }
    setError('')
    onChange(value, { submit: true })
  }

  if (!formConfig) return null

  return (
    <form className="workflow-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <h3>{formConfig.title}</h3>
        <p>{formConfig.description}</p>
      </div>
      {progressive && (
        <div className="progressive-nav">
          {fields.filter((f, i, arr) => arr.findIndex(x => x.section === f.section) === i).map((f, i) => (
            <button key={f.name} type="button" className={`prog-dot ${i === section ? 'active' : ''}`} onClick={() => setSection(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {builder ? (
        <builder.Component value={value} onChange={onChange} role={role} people={people || []} events={events} subject={subject} workflow={workflow} formConfig={formConfig} />
      ) : (
        visibleFields.map(field => (
          <div className="form-field-wrap" key={field.name}>
            <label className="form-field">
              <span>{field.label}{field.required ? ' *' : ''}</span>
              <Field field={field} value={value?.[field.name]} onChange={(name, v) => onChange({ ...value, [name]: v })} people={people || []} />
              {field.hint ? <small className="field-hint">{field.hint}</small> : null}
            </label>
            {field.type === 'textarea' && suggestions.length > 0 && (
              <div className="form-suggestions">
                <CommentChips options={suggestions} value={value?.[field.name] || ''} onInsert={v => onChange({ ...value, [field.name]: v })} />
              </div>
            )}
          </div>
        ))
      )}
      {progressive && section < fields.length - 1 && (
        <button type="button" className="prog-next" onClick={() => setSection(s => s + 1)}>Next section →</button>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <small className="form-status">{isRequiredFilled ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Ready to complete</> : 'Complete required fields to continue'}</small>
      </div>
    </form>
  )
}

