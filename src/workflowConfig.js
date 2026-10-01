// ---------------------------------------------------------------------------
// Shared workflow configuration — a single source of truth for how each module
// presents its business interface. The existing WorkflowPage engine, workflow
// engine, APIs, RBAC and DB are reused; this file only shapes WHAT each module
// shows (dashboard widgets, step forms, quick actions) so every module keeps
// its own identity instead of being one same workflow screen.
// ---------------------------------------------------------------------------

// Field type presets used across step forms.
export const FIELD_TYPES = {
  text: true, textarea: true, number: true, date: true, time: true,
  select: true, multiSelect: true, rating: true, toggle: true, money: true,
  fileHint: true, employee: true, link: true,
}

// ---------------------------------------------------------------------------
// Selection-first libraries — templates, dropdown lists, quick comments and
// intelligent defaults so HR rarely needs to type. These power the new
// selection-first field types (templateSelect, kpiLibrary, goalTemplate,
// competencyTemplate, learningTemplate, aiGenerate, quickComments).
// ---------------------------------------------------------------------------

// Intelligent defaults auto-filled into forms (current date / quarter / year /
// reviewer / period) so the only typing left is exceptional customization.
export const INTELLIGENT_DEFAULTS = () => {
  const now = new Date()
  const year = now.getFullYear()
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}') } catch { return {} } })()
  return {
    currentDate: now.toISOString().slice(0, 10),
    currentQuarter: quarter,
    currentYear: String(year),
    nextQuarter: `Q${(Math.floor(now.getMonth() / 3) + 2) % 4 || 1}`,
    period: `${quarter} ${year}`,
    reviewer: role.name || '',
    department: role.department || '',
  }
}

// Dropdown lists so fields become selections instead of free text.
export const REVIEW_TYPES = ['Annual', 'Quarterly', 'Monthly', 'Probation', 'Promotion', 'Special Review']
export const LEARNING_CATEGORIES = ['Leadership & People', 'Fleet Safety', 'Fleet Operations', 'Dispatch & Routing', 'Warehouse Operations', 'Customer Service', 'Safety & Compliance', 'Finance & Administration', 'Communication', 'Technical Skills']
export const COMPETENCY_CATEGORIES = ['Technical', 'Behavioral', 'Leadership', 'Communication', 'Operations', 'Compliance', 'Customer Service', 'Safety', 'Management']
export const TRAINING_CATEGORIES = ['Onboarding', 'Compliance', 'Technical', 'Leadership', 'Service Excellence', 'Safety']
export const RECOGNITION_CATEGORIES = ['Customer Obsession', 'Leadership', 'Innovation', 'Service Excellence', 'Teamwork', 'Safety Champion']
export const COMPETENCY_LEVELS = ['Foundation', 'Developing', 'Proficient', 'Expert']
export const SUCCESSION_READINESS = ['Ready Now', 'Ready in 1-2 Years', 'Potential', 'Not Ready']

// KPI library — selecting one auto-fills name, description, weight, target,
// measurement. HR only adjusts the weight/target values.
export const KPI_LIBRARY = [
  // ── General / Cross-department ──────────────────────────────────────────
  { name: 'Customer Satisfaction', department: 'All', description: 'Overall service satisfaction measured through customer feedback and shipment recovery surveys.', weight: 25, target: '90', measurement: 'Survey score (%)' },
  { name: 'Attendance & Punctuality', department: 'All', description: 'Consistent on-time arrival and reliable attendance across the review period.', weight: 15, target: '95', measurement: 'Attendance rate (%)' },
  { name: 'Teamwork & Collaboration', department: 'All', description: 'Constructive cooperation and contribution to team objectives across transport and warehouse operations.', weight: 10, target: '90', measurement: 'Peer review score (%)' },
  { name: 'Communication Skills', department: 'All', description: 'Clarity, professionalism, and effectiveness of verbal and written communication.', weight: 10, target: '85', measurement: 'Supervisor assessment (%)' },
  { name: 'Revenue Target Achievement', department: 'All', description: 'Personal or departmental contribution toward revenue, margin, and service objectives.', weight: 15, target: '100', measurement: 'Revenue achievement (%)' },
  { name: 'PPE & Safety Gear Compliance', department: 'All', description: 'Adherence to company safety standards, PPE requirements, and operational readiness checks.', weight: 10, target: '100', measurement: 'Compliance rate (%)' },
  { name: 'Upsell & Value Conversion', department: 'All', description: 'Success rate in converting service-extension and capacity-utilization opportunities into revenue.', weight: 15, target: '30', measurement: 'Upsell conversion rate (%)' },

  // ── Fleet & Transportation ─────────────────────────────────────────────────
  { name: 'On-Time Delivery Rate', department: 'Fleet & Transportation', description: 'Percentage of scheduled loads delivered within the committed time window.', weight: 20, target: '96', measurement: 'On-time delivery (%)' },
  { name: 'Load Utilization Rate', department: 'Fleet & Transportation', description: 'Effective utilization of available vehicle capacity while maintaining service commitments.', weight: 15, target: '90', measurement: 'Utilization rate (%)' },
  { name: 'Route Compliance', department: 'Fleet & Transportation', description: 'Adherence to planned routes, dispatch instructions, safety rules, and service windows.', weight: 20, target: '98', measurement: 'Compliance rate (%)' },
  { name: 'Delivery Speed Efficiency', department: 'Fleet & Transportation', description: 'Average time from dispatch release to customer delivery completion.', weight: 15, target: '15', measurement: 'Minutes per load' },
  { name: 'Fuel & Cost Efficiency', department: 'Fleet & Transportation', description: 'Fuel consumption and operating efficiency relative to distance and delivery plan.', weight: 15, target: '92', measurement: 'Efficiency score (%)' },
  { name: 'Incident Recovery Rate', department: 'Fleet & Transportation', description: 'Percentage of transportation exceptions resolved without service failure or customer escalation.', weight: 15, target: '95', measurement: 'Recovery rate (%)' },
  { name: 'Vehicle Inspection Score', department: 'Fleet & Transportation', description: 'Quality and completeness of pre-trip and post-trip vehicle inspection records.', weight: 10, target: '100', measurement: 'Inspection pass rate (%)' },
  { name: 'Load Securement Accuracy', department: 'Fleet & Transportation', description: 'Percentage of shipments loaded and secured according to approved cargo restraint standards.', weight: 20, target: '100', measurement: 'Securement compliance (%)' },
  { name: 'Trip Cost Variance', department: 'Fleet & Transportation', description: 'Deviation between approved trip cost and actual operating cost for dispatched loads.', weight: 10, target: '2', measurement: 'Variance % (lower is better)' },

  // ── Dispatch & Routing ──────────────────────────────────────────────────
  { name: 'Dispatch Accuracy', department: 'Dispatch & Routing', description: 'Percentage of loads assigned and updated correctly against schedule and route requirements.', weight: 20, target: '98', measurement: 'Accuracy rate (%)' },
  { name: 'Route Planning Quality', department: 'Dispatch & Routing', description: 'Ability to generate efficient routes that balance service windows, capacity, and driver availability.', weight: 20, target: '95', measurement: 'Planning score (%)' },
  { name: 'Exception Response Time', department: 'Dispatch & Routing', description: 'Average time to respond to late deliveries, detours, or route disruptions.', weight: 15, target: '20', measurement: 'Minutes to response' },
  { name: 'TMS Data Integrity', department: 'Dispatch & Routing', description: 'Accuracy and completeness of shipment tracking, milestone updates, and system inputs.', weight: 15, target: '99', measurement: 'Data quality (%)' },
  { name: 'Capacity Allocation Accuracy', department: 'Dispatch & Routing', description: 'Correct matching of loads to vehicles, drivers, and operational windows.', weight: 20, target: '97', measurement: 'Allocation accuracy (%)' },
  { name: 'Emergency Reassignment Speed', department: 'Dispatch & Routing', description: 'Speed and quality of rerouting and reassignment when service interruptions occur.', weight: 10, target: '90', measurement: 'Reassignment score (%)' },

  // ── Warehouse & Inventory ─────────────────────────────────────────────────
  { name: 'Inventory Accuracy', department: 'Warehouse & Inventory', description: 'Percentage of inventory records matching physical counts and warehouse transactions.', weight: 25, target: '98', measurement: 'Inventory accuracy (%)' },
  { name: 'Picking & Packing Accuracy', department: 'Warehouse & Inventory', description: 'Correctness of picked, packed, and staged shipments before dispatch.', weight: 20, target: '99', measurement: 'Accuracy rate (%)' },
  { name: 'Dock Turnaround Time', department: 'Warehouse & Inventory', description: 'Average time from receiving to put-away or outbound staging for load readiness.', weight: 15, target: '45', measurement: 'Minutes per load' },
  { name: 'Cycle Count Completion', department: 'Warehouse & Inventory', description: 'Timely completion of count cycles and variance investigation for inventory controls.', weight: 15, target: '100', measurement: 'Completion rate (%)' },
  { name: 'Forklift Safety & Handling', department: 'Warehouse & Inventory', description: 'Safe equipment operation, load stability control, and compliance with warehouse traffic rules.', weight: 20, target: '100', measurement: 'Safety compliance (%)' },
  { name: 'Damage Prevention Rate', department: 'Warehouse & Inventory', description: 'Rate at which freight is handled without damage, loss, or quality defects.', weight: 20, target: '99', measurement: 'Damage-free rate (%)' },

  // ── Customer Service ──────────────────────────────────────────────────────
  { name: 'Shipment Tracking Quality', department: 'Customer Service', description: 'Quality and accuracy of shipment status updates given to customers and internal stakeholders.', weight: 20, target: '96', measurement: 'Update accuracy (%)' },
  { name: 'Issue Resolution Time', department: 'Customer Service', description: 'Average time to resolve customer issues, exceptions, and service escalations.', weight: 20, target: '12', measurement: 'Hours to resolution' },
  { name: 'Claims Documentation Quality', department: 'Customer Service', description: 'Completeness and accuracy of documentation required for claims, returns, and proof-of-delivery follow-up.', weight: 15, target: '98', measurement: 'Documentation score (%)' },
  { name: 'Service Recovery Rate', department: 'Customer Service', description: 'Percentage of at-risk shipments resolved to customer satisfaction without repeat escalation.', weight: 20, target: '95', measurement: 'Recovery rate (%)' },
  { name: 'Customer Response Score', department: 'Customer Service', description: 'Quality of customer communication measured through service feedback and case review.', weight: 15, target: '90', measurement: 'Service score (%)' },

  // ── Safety & Compliance ───────────────────────────────────────────────────
  { name: 'Safety Audit Score', department: 'Safety & Compliance', description: 'Performance against periodic workplace safety, compliance, and incident-prevention checks.', weight: 25, target: '95', measurement: 'Audit score (%)' },
  { name: 'Corrective Action Closure', department: 'Safety & Compliance', description: 'Timeliness and completeness of corrective actions following audits, incidents, or observations.', weight: 20, target: '100', measurement: 'Closure rate (%)' },
  { name: 'Regulatory Documentation Accuracy', department: 'Safety & Compliance', description: 'Completeness of required regulatory, driver qualification, and operational records.', weight: 15, target: '99', measurement: 'Record accuracy (%)' },
  { name: 'Incident Reporting Timeliness', department: 'Safety & Compliance', description: 'Speed and completeness of accident, near-miss, and safety event reporting.', weight: 20, target: '100', measurement: 'Reporting timeliness (%)' },

  // ── Finance & Administration ───────────────────────────────────────────────
  { name: 'Invoice Accuracy Rate', department: 'Finance & Administration', description: 'Accuracy of billing entries, accessorial charges, and customer invoice adjustments.', weight: 20, target: '99', measurement: 'Accuracy rate (%)' },
  { name: 'Audit Readiness Score', department: 'Finance & Administration', description: 'Quality and completeness of reconciliations, records retention, and supporting documentation.', weight: 15, target: '95', measurement: 'Readiness score (%)' },
  { name: 'Cost Control Compliance', department: 'Finance & Administration', description: 'Ability to keep operational costs aligned to plan and identify variance promptly.', weight: 15, target: '95', measurement: 'Variance adherence (%)' },
]

// Learning template library — selecting one auto-fills title, description,
// objectives, duration, category. Users only edit if needed.
export const LEARNING_TEMPLATES = [
  { title: 'Defensive Driving & Hours-of-Service Compliance', category: 'Fleet Safety', duration: '6', description: 'Apply defensive driving, fatigue management, safe journey planning, and driver-hours rules.', objectives: 'Identify driving risks; plan safe journeys; comply with driver-hours requirements; report incidents.' },
  { title: 'Pre-Trip and Post-Trip Vehicle Inspection', category: 'Fleet Safety', duration: '3', description: 'Perform vehicle walkarounds, identify defects, and record inspection results.', objectives: 'Complete inspection checklists; identify defects; report and escalate unsafe vehicles.' },
  { title: 'Cargo Securement and Load Restraint', category: 'Fleet Operations', duration: '4', description: 'Select restraints and distribute freight to reduce load shift and cargo damage.', objectives: 'Assess load stability; select securement methods; complete departure checks.' },
  { title: 'Driver Fatigue and Journey Risk Management', category: 'Fleet Safety', duration: '3', description: 'Recognize fatigue risks and plan routes with appropriate controls and escalation.', objectives: 'Recognize fatigue indicators; assess journey risks; apply controls and communicate delays.' },
  { title: 'TMS and GPS Dispatch Fundamentals', category: 'Dispatch & Routing', duration: '4', description: 'Use transport systems and GPS tools to plan loads, update statuses, and coordinate drivers.', objectives: 'Maintain shipment milestones; assign loads; communicate dispatch changes accurately.' },
  { title: 'Route Planning and Delivery Window Optimization', category: 'Dispatch & Routing', duration: '5', description: 'Build efficient routes using capacity, customer windows, traffic, and service constraints.', objectives: 'Sequence stops; balance capacity; monitor route performance and exceptions.' },
  { title: 'Load Scheduling and Capacity Planning', category: 'Dispatch & Routing', duration: '4', description: 'Schedule loads and match freight to vehicle capacity and dispatch cutoffs.', objectives: 'Plan loads; identify capacity conflicts; issue clear dispatch instructions.' },
  { title: 'Warehouse Safety and Incident Reporting', category: 'Warehouse Operations', duration: '3', description: 'Apply safe warehouse practices and report hazards, incidents, and near misses.', objectives: 'Identify hazards; follow safe movement rules; document incidents and actions.' },
  { title: 'Forklift Operator Safety and Load Stability', category: 'Warehouse Operations', duration: '4', description: 'Inspect powered equipment and move freight using safe load-handling practices.', objectives: 'Inspect forklift; maintain load stability; protect pedestrian zones.' },
  { title: 'Freight Receiving, Scanning and Inventory Accuracy', category: 'Warehouse Operations', duration: '3', description: 'Verify inbound freight and maintain accurate scan, receipt, and inventory records.', objectives: 'Verify quantities; scan freight; resolve and document discrepancies.' },
  { title: 'Order Picking, Packing and Shipment Staging', category: 'Warehouse Operations', duration: '3', description: 'Pick and stage freight accurately for shipment, route, and dispatch cutoff.', objectives: 'Follow pick instructions; protect shipments; verify labels and staging lanes.' },
  { title: 'Freight Customer Service and Shipment Visibility', category: 'Customer Service', duration: '3', description: 'Research shipment status and provide clear, timely customer updates.', objectives: 'Trace shipments; share verified updates; own inquiries through resolution.' },
  { title: 'Freight Claims and Proof-of-Delivery Accuracy', category: 'Customer Service', duration: '4', description: 'Capture proof of delivery and assemble accurate evidence for returns and claims.', objectives: 'Complete POD records; document exceptions; retain evidence and coordinate claims.' },
  { title: 'Transportation Regulations and Document Control', category: 'Safety & Compliance', duration: '4', description: 'Maintain operating records and follow applicable transport and workplace requirements.', objectives: 'Identify required documents; maintain records; escalate compliance risks.' },
  { title: 'Incident Investigation and Corrective Action', category: 'Safety & Compliance', duration: '4', description: 'Investigate incidents, identify root causes, and track preventive actions.', objectives: 'Document facts; identify contributing causes; verify corrective action closure.' },
  { title: 'Freight Billing, Rating and Invoice Auditing', category: 'Finance & Administration', duration: '4', description: 'Verify contracted freight rates, shipment records, and accessorial charges.', objectives: 'Audit invoices; find rating discrepancies; document adjustments and approvals.' },
  { title: 'Frontline Leadership for Logistics Supervisors', category: 'Leadership & People', duration: '6', description: 'Lead shift huddles, coach employees, manage escalations, and use operating data.', objectives: 'Set shift priorities; coach safely; resolve operating issues; review team performance.' },
  { title: 'Employee Onboarding and Driver Qualification', category: 'Human Resources', duration: '4', description: 'Complete role onboarding and maintain driver qualification and employee records.', objectives: 'Complete onboarding; verify required qualifications; record training and policy signoff.' },
]

// Mapping linking competency categories/names to recommended learning template categories
export const COMPETENCY_LEARNING_MAP = {
  'Defensive Driving': ['Defensive Driving & Hours-of-Service Compliance', 'Driver Fatigue and Journey Risk Management'],
  'Vehicle Inspection & Preventive Checks': ['Pre-Trip and Post-Trip Vehicle Inspection'],
  'Route Compliance': ['Route Planning and Delivery Window Optimization', 'Defensive Driving & Hours-of-Service Compliance'],
  'Cargo Securement': ['Cargo Securement and Load Restraint'],
  'Fuel-Efficient Operations': ['Defensive Driving & Hours-of-Service Compliance'],
  'Route Planning & Optimization': ['Route Planning and Delivery Window Optimization'],
  'Load Scheduling': ['Load Scheduling and Capacity Planning'],
  'Dispatch Communication': ['TMS and GPS Dispatch Fundamentals'],
  'TMS & GPS Proficiency': ['TMS and GPS Dispatch Fundamentals'],
  'Exception Management': ['Dispatch Exceptions and Delay Recovery'],
  'Inventory Accuracy': ['Freight Receiving, Scanning and Inventory Accuracy'],
  'Picking & Packing': ['Order Picking, Packing and Shipment Staging'],
  'Forklift Operation & Safety': ['Forklift Operator Safety and Load Stability'],
  'Warehouse Safety': ['Warehouse Safety and Incident Reporting'],
  'WMS Proficiency': ['Freight Receiving, Scanning and Inventory Accuracy'],
  'Shipment Tracking': ['Freight Customer Service and Shipment Visibility'],
  'Customer Communication': ['Freight Customer Service and Shipment Visibility'],
  'Claims Resolution': ['Freight Claims and Proof-of-Delivery Accuracy'],
  'Proof-of-Delivery Accuracy': ['Freight Claims and Proof-of-Delivery Accuracy'],
  'Service Recovery': ['Freight Customer Service and Shipment Visibility'],
  'Regulatory Compliance': ['Transportation Regulations and Document Control'],
  'Incident Reporting': ['Incident Investigation and Corrective Action'],
  'Risk Assessment': ['Driver Fatigue and Journey Risk Management', 'Incident Investigation and Corrective Action'],
  'Driver Coaching': ['Frontline Leadership for Logistics Supervisors'],
  'Emergency Response': ['Warehouse Safety and Incident Reporting'],
  'Employee Relations': ['Employee Onboarding and Driver Qualification'],
  'Recruitment & Selection': ['Employee Onboarding and Driver Qualification'],
  'Labor Compliance': ['Employee Onboarding and Driver Qualification', 'Transportation Regulations and Document Control'],
  'Leadership': ['Frontline Leadership for Logistics Supervisors'],
  'Operational Management': ['Frontline Leadership for Logistics Supervisors'],
  'Financial Acumen': ['Freight Billing, Rating and Invoice Auditing'],
  'Strategic Planning': ['Frontline Leadership for Logistics Supervisors'],
  'Data-Driven Decision Making': ['Route Planning and Delivery Window Optimization'],
  'Freight Billing & Audit': ['Freight Billing, Rating and Invoice Auditing'],
  'Accounts Reconciliation': ['Freight Billing, Rating and Invoice Auditing'],
  'Internal Controls': ['Freight Billing, Rating and Invoice Auditing'],
  'Documentation Accuracy': ['Transportation Regulations and Document Control'],
  'Communication': ['Freight Customer Service and Shipment Visibility'],
}

export function getRecommendedCoursesForGap(competencyName) {
  const competency = String(competencyName || '').trim()
  const matchedTitles = COMPETENCY_LEARNING_MAP[competency] || []
  const matches = LEARNING_TEMPLATES.filter(course => matchedTitles.includes(course.title))
  if (matches.length) return matches

  const key = competency.toLowerCase()
  const containsAny = (...terms) => terms.some(term => key.includes(term))
  let courseTitle = 'Frontline Leadership for Logistics Supervisors'
  if (containsAny('driver', 'driving', 'fleet', 'vehicle', 'cargo', 'securement')) courseTitle = 'Defensive Driving & Hours-of-Service Compliance'
  else if (containsAny('route', 'dispatch', 'load', 'tms', 'gps')) courseTitle = 'TMS and GPS Dispatch Fundamentals'
  else if (containsAny('warehouse', 'forklift', 'inventory', 'picking', 'packing', 'wms')) courseTitle = 'Warehouse Safety and Incident Reporting'
  else if (containsAny('claim', 'shipment', 'customer', 'proof', 'delivery')) courseTitle = 'Freight Customer Service and Shipment Visibility'
  else if (containsAny('compliance', 'safety', 'incident', 'risk', 'emergency')) courseTitle = 'Transportation Regulations and Document Control'
  else if (containsAny('billing', 'finance', 'account', 'cost', 'control')) courseTitle = 'Freight Billing, Rating and Invoice Auditing'
  else if (containsAny('employee', 'recruit', 'labor', 'onboard')) courseTitle = 'Employee Onboarding and Driver Qualification'
  return LEARNING_TEMPLATES.filter(course => course.title === courseTitle)
}

// ---------------------------------------------------------------------------
// Pre-built & Dynamic AI Curricula for Logistics Learning Resources
// ---------------------------------------------------------------------------
export const AI_CURRICULUM_LIBRARY = {
  'customer service': `# Module 1: Freight Service Fundamentals
- **Shipment lifecycle**: Understand pickup, terminal handling, linehaul, delivery, and proof-of-delivery milestones.
- **Verified updates**: Check the TMS and source records before communicating shipment status.
- **Service commitments**: Explain delivery windows, constraints, and next steps clearly.

# Module 2: Customer Communication
- **Active listening**: Confirm shipment identifiers, issue details, and the customer's requested outcome.
- **Clear status messages**: Give verified facts, expected next updates, and an accountable contact.
- **Case ownership**: Track an inquiry through resolution and document handoffs.

# Module 3: Exceptions and Claims
- **Delay recovery**: Notify dispatch, identify options, and set a realistic revised expectation.
- **Damage or shortage**: Record condition, collect proof, and route the case through claims procedures.
- **Proof of delivery**: Confirm receiver, timestamp, and supporting delivery evidence.

# Key Practices
> Provide accurate, timely freight updates and own each service case through closure.`,
  leadership: `# Module 1: Logistics Shift Leadership
- **Shift huddles**: Review safety alerts, staffing, loads, delivery cutoffs, and service risks.
- **Capacity allocation**: Match qualified people and equipment to the day's operating plan.
- **Clear handovers**: Record open exceptions, safety issues, and next accountable actions.

# Module 2: Coaching and Performance
- **Specific feedback**: Use observed behaviors and operating measures, not assumptions.
- **Driver coaching**: Address safe driving, inspection, and route-compliance trends promptly.
- **Skill development**: Assign role-relevant learning and verify application on the job.

# Module 3: Operational Problem Solving
- **Identify bottlenecks**: Review late loads, queue time, utilization, and repeated exceptions.
- **Escalate risk**: Protect people and freight first, then coordinate recovery actions.
- **Improve the process**: Verify corrective actions with follow-up data.

# Key Practices
> Balance safety, customer commitments, and operating efficiency in every decision.`,
  'fleet safety': `# Module 1: Driver and Journey Readiness
- **Fitness and fatigue**: Confirm readiness for duty and take required rest breaks.
- **Route risk**: Review road, weather, delivery, and site-access conditions.
- **Hours compliance**: Follow applicable driving and rest limits and maintain required records.

# Module 2: Vehicle and Load Safety
- **Pre-trip inspection**: Check tires, brakes, lights, restraints, and required equipment.
- **Cargo securement**: Distribute weight and verify restraints before departure and during required checks.
- **Defect escalation**: Do not operate unsafe equipment; report defects through the approved process.

# Module 3: Incident Prevention and Response
- **Defensive driving**: Maintain space, speed control, and hazard awareness.
- **Incident response**: Secure the scene, notify the proper contacts, and preserve accurate facts.
- **Corrective action**: Complete follow-up coaching and prevention steps.

# Key Practices
> Protect people first, protect freight second, and document each required safety action.`,
  'warehouse safety': `# Module 1: Safe Warehouse Movement
- **Pedestrian and vehicle zones**: Use marked routes and maintain visibility at intersections.
- **Forklift checks**: Inspect equipment and remove defective trucks from service.
- **Load stability**: Respect rated capacity, stable stacking, and secure staging.

# Module 2: Freight Accuracy
- **Receiving and scanning**: Verify shipment identity, quantity, and condition at receipt.
- **Location control**: Record put-away and movement transactions in the WMS.
- **Pick and stage**: Match freight, labels, and dispatch lane before cutoff.

# Module 3: Hazard and Incident Reporting
- **Stop unsafe work**: Isolate hazards and notify the supervisor.
- **Near misses**: Record facts so controls can prevent recurrence.
- **Corrective actions**: Track assigned actions through verified closure.

# Key Practices
> Safe movement and accurate scans preserve people, inventory, and service reliability.`,
  'conflict resolution': `# Module 1: De-escalation in Freight Operations
- **Stay factual**: Confirm shipment events and avoid assigning blame before investigation.
- **Listen and clarify**: Identify the customer's or coworker's concern and desired resolution.
- **Use calm language**: Explain known facts and the next action without overpromising.

# Module 2: Coordinated Resolution
- **Identify the owner**: Engage dispatch, warehouse, fleet, or claims as needed.
- **Present options**: Explain practical recovery options and their timing.
- **Record agreements**: Document commitments, owners, and follow-up time.

# Module 3: Prevent Recurrence
- **Find the process cause**: Review handoffs, data, and operating constraints.
- **Escalate safety risk**: Stop or escalate unsafe activity immediately.
- **Close the loop**: Verify the resolution and share lessons with the right team.

# Key Practices
> Resolve issues respectfully, based on verified facts, and with clear ownership.`,
}

export function getAiCurriculumForCourse(resource = {}) {
  const text = `${resource.title || ''} ${resource.category || ''} ${resource.description || ''}`.toLowerCase()
  if (/warehouse|forklift|inventory|picking|packing|wms/.test(text)) return AI_CURRICULUM_LIBRARY['warehouse safety']
  if (/driver|fleet|vehicle|cargo|driving|hours-of-service|inspection/.test(text)) return AI_CURRICULUM_LIBRARY['fleet safety']
  if (/customer|shipment|claim|proof.of.delivery|service/.test(text)) return AI_CURRICULUM_LIBRARY['customer service']
  if (/leader|supervis|coach|manage/.test(text)) return AI_CURRICULUM_LIBRARY.leadership
  if (/conflict|communicat/.test(text)) return AI_CURRICULUM_LIBRARY['conflict resolution']
  if (/safety|compliance|incident|regulat/.test(text)) return AI_CURRICULUM_LIBRARY['fleet safety']
  const courseName = resource.title || 'Freight & Logistics Training'
  return `# Module 1: ${courseName}\n- Review the role requirements, operating procedure, and safety controls.\n- Identify the system, equipment, and records used for this task.\n\n# Module 2: Practical Application\n- Complete the workflow using current company procedures.\n- Verify freight, data, and handoffs before closing the task.\n\n# Module 3: Exceptions and Assessment\n- Recognize common exceptions and escalate risks to the correct owner.\n- Demonstrate the task and document the result.\n\n# Key Practices\n> Apply the procedure consistently, protect people and freight, and record accurate outcomes.`
}

const benchmark = (competency, category, targetScore = 85, level = 'Proficient', weight = 20) => ({
  competency,
  category,
  targetScore,
  level,
  weight,
})

export const COMPETENCY_TEMPLATES = {
  'Logistics General Manager': [
    benchmark('Operational Management', 'Leadership', 92, 'Expert', 25),
    benchmark('Strategic Planning', 'Leadership', 90, 'Expert', 20),
    benchmark('Financial Acumen', 'Finance', 88, 'Expert', 20),
    benchmark('Safety & Compliance Leadership', 'Compliance', 95, 'Expert', 20),
    benchmark('Customer Service', 'Customer Service', 88, 'Expert', 15),
  ],
  'HR Administrator': [
    benchmark('Employee Relations', 'People', 88, 'Expert', 25),
    benchmark('Labor Compliance', 'Compliance', 95, 'Expert', 25),
    benchmark('Recruitment & Selection', 'People', 88, 'Proficient', 20),
    benchmark('Learning & Development', 'People', 85, 'Proficient', 15),
    benchmark('HR Data & Documentation Accuracy', 'Administration', 95, 'Expert', 15),
  ],
  'Fleet Operations Manager': [
    benchmark('Fleet Utilization & Availability', 'Fleet Operations', 90, 'Expert', 20),
    benchmark('Preventive Maintenance Coordination', 'Fleet Operations', 92, 'Expert', 20),
    benchmark('Route Compliance', 'Safety', 95, 'Expert', 20),
    benchmark('Incident Response & Recovery', 'Safety', 90, 'Expert', 20),
    benchmark('Cost & Fuel Efficiency', 'Operations', 88, 'Proficient', 20),
  ],
  'Dispatch Supervisor': [
    benchmark('Route Planning & Optimization', 'Dispatch', 92, 'Expert', 25),
    benchmark('Load Scheduling & Capacity Planning', 'Dispatch', 90, 'Expert', 20),
    benchmark('TMS & GPS Proficiency', 'Technical', 95, 'Expert', 20),
    benchmark('Exception Management', 'Operations', 90, 'Expert', 20),
    benchmark('Dispatch Communication', 'Communication', 88, 'Proficient', 15),
  ],
  'Warehouse Supervisor': [
    benchmark('Warehouse Safety', 'Safety', 95, 'Expert', 25),
    benchmark('Inventory Accuracy', 'Inventory', 95, 'Expert', 20),
    benchmark('Picking & Packing Accuracy', 'Operations', 95, 'Expert', 20),
    benchmark('WMS Proficiency', 'Technical', 90, 'Proficient', 15),
    benchmark('Shift Leadership & Coaching', 'Leadership', 88, 'Expert', 20),
  ],
  'Transportation Supervisor': [
    benchmark('Driver Coaching', 'Leadership', 90, 'Expert', 20),
    benchmark('Defensive Driving & Safety Oversight', 'Safety', 95, 'Expert', 25),
    benchmark('Vehicle Inspection Compliance', 'Fleet Operations', 95, 'Expert', 20),
    benchmark('Route & Hours-of-Service Compliance', 'Compliance', 95, 'Expert', 20),
    benchmark('Incident Reporting', 'Safety', 90, 'Proficient', 15),
  ],
  'Safety & Compliance Manager': [
    benchmark('Regulatory Compliance', 'Compliance', 95, 'Expert', 25),
    benchmark('Risk Assessment', 'Safety', 92, 'Expert', 20),
    benchmark('Incident Investigation', 'Safety', 90, 'Expert', 20),
    benchmark('Corrective Action Management', 'Compliance', 92, 'Expert', 20),
    benchmark('Safety Training & Communication', 'Leadership', 88, 'Proficient', 15),
  ],
  'Customer Service Representative': [
    benchmark('Shipment Tracking & Visibility', 'Customer Service', 90, 'Proficient', 25),
    benchmark('Customer Communication', 'Communication', 90, 'Proficient', 20),
    benchmark('Issue & Claims Resolution', 'Customer Service', 88, 'Proficient', 20),
    benchmark('Proof-of-Delivery Accuracy', 'Documentation', 95, 'Proficient', 20),
    benchmark('TMS Data Accuracy', 'Technical', 95, 'Proficient', 15),
  ],
  Driver: [
    benchmark('Defensive Driving', 'Safety', 95, 'Proficient', 25),
    benchmark('Vehicle Inspection & Preventive Checks', 'Fleet Operations', 95, 'Proficient', 20),
    benchmark('Route & Hours-of-Service Compliance', 'Compliance', 95, 'Proficient', 20),
    benchmark('Cargo Securement', 'Fleet Operations', 95, 'Proficient', 20),
    benchmark('Delivery Documentation & Communication', 'Operations', 88, 'Proficient', 15),
  ],
  'Heavy Vehicle Driver': [
    benchmark('Defensive Driving', 'Safety', 95, 'Expert', 25),
    benchmark('Vehicle Inspection & Preventive Checks', 'Fleet Operations', 95, 'Expert', 20),
    benchmark('Route & Hours-of-Service Compliance', 'Compliance', 95, 'Expert', 20),
    benchmark('Cargo Securement', 'Fleet Operations', 95, 'Expert', 20),
    benchmark('Incident Response & Reporting', 'Safety', 90, 'Proficient', 15),
  ],
  'Dispatcher': [
    benchmark('Dispatch Communication', 'Communication', 88, 'Proficient', 20),
    benchmark('Route Planning & Optimization', 'Dispatch', 90, 'Proficient', 25),
    benchmark('Load Scheduling', 'Dispatch', 90, 'Proficient', 20),
    benchmark('TMS & GPS Proficiency', 'Technical', 95, 'Proficient', 20),
    benchmark('Exception Management', 'Operations', 88, 'Proficient', 15),
  ],
  'Warehouse Associate': [
    benchmark('Warehouse Safety', 'Safety', 95, 'Proficient', 25),
    benchmark('Freight Scanning & Inventory Accuracy', 'Inventory', 92, 'Proficient', 20),
    benchmark('Picking & Packing', 'Operations', 92, 'Proficient', 20),
    benchmark('Shipment Staging & Load Readiness', 'Operations', 90, 'Proficient', 20),
    benchmark('WMS Proficiency', 'Technical', 85, 'Developing', 15),
  ],
  'Inventory Control Clerk': [
    benchmark('Inventory Accuracy', 'Inventory', 95, 'Proficient', 25),
    benchmark('Cycle Counting & Variance Resolution', 'Inventory', 92, 'Proficient', 25),
    benchmark('WMS Data Integrity', 'Technical', 95, 'Proficient', 20),
    benchmark('Receiving & Shipping Documentation', 'Documentation', 90, 'Proficient', 15),
    benchmark('Cross-Functional Communication', 'Communication', 85, 'Proficient', 15),
  ],
  'Forklift Operator': [
    benchmark('Forklift Operation & Safety', 'Safety', 95, 'Proficient', 30),
    benchmark('Load Stability & Handling', 'Operations', 95, 'Proficient', 25),
    benchmark('Warehouse Traffic & Pedestrian Safety', 'Safety', 95, 'Proficient', 20),
    benchmark('Freight Scanning & Staging', 'Operations', 90, 'Proficient', 15),
    benchmark('Equipment Inspection & Reporting', 'Fleet Operations', 90, 'Proficient', 10),
  ],
  'Route Planner': [
    benchmark('Route Planning & Optimization', 'Dispatch', 92, 'Proficient', 25),
    benchmark('Delivery Window & Constraint Planning', 'Dispatch', 90, 'Proficient', 20),
    benchmark('Capacity & Load Allocation', 'Operations', 90, 'Proficient', 20),
    benchmark('TMS & GPS Proficiency', 'Technical', 95, 'Proficient', 20),
    benchmark('Exception & Detour Planning', 'Operations', 88, 'Proficient', 15),
  ],
  'Fleet Coordinator': [
    benchmark('Fleet Availability Coordination', 'Fleet Operations', 90, 'Proficient', 25),
    benchmark('Preventive Maintenance Tracking', 'Fleet Operations', 92, 'Proficient', 25),
    benchmark('Vehicle Inspection Record Accuracy', 'Compliance', 95, 'Proficient', 20),
    benchmark('Dispatch & Driver Coordination', 'Communication', 88, 'Proficient', 15),
    benchmark('Fleet Data & Cost Reporting', 'Administration', 85, 'Proficient', 15),
  ],
  'Safety Coordinator': [
    benchmark('Workplace & Transport Risk Assessment', 'Safety', 92, 'Proficient', 25),
    benchmark('Incident Reporting & Investigation', 'Safety', 90, 'Proficient', 25),
    benchmark('Regulatory Documentation', 'Compliance', 95, 'Proficient', 20),
    benchmark('Corrective Action Follow-Up', 'Compliance', 90, 'Proficient', 15),
    benchmark('Safety Communication & Training', 'Communication', 88, 'Proficient', 15),
  ],
}

export const GOAL_TEMPLATES = [
  { title: 'Improve on-time delivery', category: 'Fleet & Transportation', description: 'Increase on-time delivery performance while maintaining safe operations.' },
  { title: 'Improve inventory accuracy', category: 'Warehouse & Inventory', description: 'Reduce inventory variances through accurate scans, counts, and reconciliation.' },
  { title: 'Reduce shipment exceptions', category: 'Dispatch & Routing', description: 'Improve route planning and exception response to prevent avoidable service failures.' },
  { title: 'Strengthen customer shipment visibility', category: 'Customer Service', description: 'Provide timely, verified updates and resolve shipment inquiries within service targets.' },
]

export const QUICK_COMMENTS = {
  performance: ['Consistently meets delivery and service commitments.', 'Follows safety procedures and reports risks promptly.', 'Improves shipment accuracy and operational handoffs.'],
  competency: ['Demonstrates role-specific logistics proficiency.', 'Apply the recommended learning plan and review progress.', 'Continue supervised practice on identified skill gaps.'],
  learning: ['Completed the assigned learning and applied it on shift.', 'Schedule a follow-up competency check.', 'Additional practice is recommended before sign-off.'],
  training: ['Training objectives were met.', 'Knowledge transfer to daily operations is evident.', 'Schedule a refresher and verify practical application.'],
  succession: ['Demonstrates readiness for broader logistics responsibility.', 'Build experience with cross-functional operations.', 'Strengthen coaching and decision-making evidence.'],
  recognition: ['Recognized for safe, reliable freight operations.', 'Demonstrated strong teamwork across logistics teams.', 'Delivered an exceptional customer recovery.'],
}

const stepForm = (title, description, builder, fields = [], extra = {}) => ({
  title,
  description,
  ...(builder ? { builder } : {}),
  ...(fields.length ? { fields } : {}),
  ...extra,
})

const employeeField = { name: 'employee', label: 'Employee', type: 'employee', required: true }
const periodField = { name: 'period', label: 'Review period', type: 'text', required: true }

const MODULE_CONFIGS = {
  performance: {
    dashboard: { heading: 'Performance overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'performance', label: 'Average performance', source: 'averagePerformance', type: 'pct' },
      { key: 'active', label: 'Active workflows', source: 'activeWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      create_review: stepForm('Create performance review', 'Set the employee and review period.', null, [
        employeeField, periodField,
        { name: 'reviewType', label: 'Review type', type: 'select', options: REVIEW_TYPES, required: true },
      ]),
      self_assessment: stepForm('Self-assessment', 'Rate performance criteria and record your reflections.', 'assessment'),
      performance_evaluation: stepForm('Supervisor evaluation', 'Review performance against logistics KPIs.', 'assessment'),
      calibration: stepForm('Performance calibration', 'Compare employee and supervisor ratings and record the calibrated outcome.', 'calibration'),
      final_approval: stepForm('Final approval', 'Review the calibrated performance outcome.', null, [
        { name: 'decision', label: 'Approval decision', type: 'select', options: ['Approve', 'Return for Revision'], required: true },
        { name: 'approvalNotes', label: 'Approval notes', type: 'textarea' },
      ], { approval: true }),
      published: stepForm('Publish results', 'Confirm the final review is ready to publish.', null, [], { aiOnly: true }),
    },
  },
  competency: {
    dashboard: { heading: 'Skill development overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'competency', label: 'Average competency', source: 'averageCompetency', type: 'pct' },
      { key: 'active', label: 'Active plans', source: 'activeWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      define_requirements: stepForm('Define competency requirements', 'Choose a logistics role benchmark and review its competency targets.', 'competencyRequirement'),
      assign_plan: stepForm('Assign development plan', 'Review competency gaps and assign role-relevant learning.', 'skillGapPlan'),
      track_progress: stepForm('Track learning progress', 'Record progress on assigned learning activities.', 'progress'),
      update_record: stepForm('Update competency record', 'Review updated competency evidence and scores.', 'competencyComparison'),
    },
  },
  learning: {
    dashboard: { heading: 'Learning overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'learning', label: 'Learning completion', source: 'learningCompletion', type: 'pct' },
      { key: 'active', label: 'Active workflows', source: 'activeWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      publish_resources: stepForm('Publish learning resources', 'Add freight and logistics learning resources to the library.', 'resources'),
      enrollment: stepForm('Enroll employees', 'Assign learning resources to employees.', 'assignEmployees'),
      complete_activities: stepForm('Complete learning activities', 'Record completion progress for assigned learning.', 'progress'),
      assessment: stepForm('Post-learning assessment', 'Review learning outcomes and practical application.', 'assessment'),
      update_competency: stepForm('Update competency record', 'Record competency changes supported by completed learning.', 'competencyComparison'),
    },
  },
  training: {
    dashboard: { heading: 'Training overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'learning', label: 'Learning completion', source: 'learningCompletion', type: 'pct' },
      { key: 'active', label: 'Active workflows', source: 'activeWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      invite: stepForm('Invite training participants', 'Select a scheduled logistics training session and participants.', 'trainingInvite'),
      effectiveness: stepForm('Measure training effectiveness', 'Assess skill application and operational outcomes.', 'assessment'),
      published: stepForm('Publish training analytics', 'Confirm training outcomes are ready for reporting.', null, [], { aiOnly: true }),
    },
  },
  succession: {
    dashboard: { heading: 'Succession overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'competency', label: 'Average competency', source: 'averageCompetency', type: 'pct' },
      { key: 'active', label: 'Active assessments', source: 'activeWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      initiate: stepForm('Initiate succession assessment', 'Select an employee and critical logistics position.', null, [
        employeeField,
        { name: 'targetPosition', label: 'Target position', type: 'text', required: true },
      ]),
      nominate: stepForm('Candidate nomination', 'Review the candidate and record succession evidence.', 'successionAssessment'),
      review_readiness: stepForm('Review readiness', 'Assess role readiness and development actions.', 'successionReview'),
      approved: stepForm('Succession approval', 'Confirm the target logistics position and final approval.', 'successionApproval', [], { approval: true }),
    },
  },
  recognition: {
    dashboard: { heading: 'Recognition overview', widgets: [
      { key: 'employees', label: 'Employees', source: 'employeeCount' },
      { key: 'active', label: 'Active nominations', source: 'activeWorkflows' },
      { key: 'completed', label: 'Completed nominations', source: 'completedWorkflows' },
    ] },
    quickActions: [],
    stepForms: {
      submitted: stepForm('Submit recognition nomination', 'Recognize a specific logistics contribution with supporting context.', 'nominations'),
      supervisor_validation: stepForm('Validate recognition nomination', 'Verify the nomination against the documented achievement.', null, [
        { name: 'decision', label: 'Validation decision', type: 'select', options: ['Validate', 'Return for Revision', 'Reject'], required: true },
        { name: 'comment', label: 'Validation notes', type: 'textarea', required: true },
      ]),
      hr_review: stepForm('HR recognition review', 'Review the validated nomination for final publication.', null, [
        { name: 'decision', label: 'Review decision', type: 'select', options: ['Approve', 'Return for Revision', 'Reject'], required: true },
        { name: 'comment', label: 'Review notes', type: 'textarea' },
      ], { approval: true }),
    },
  },
}

export function configFor(moduleKey) {
  return MODULE_CONFIGS[moduleKey] || MODULE_CONFIGS.performance
}

export function isApprovalStage(stageKey, formConfig) {
  return Boolean(formConfig?.approval || ['final_approval', 'approved', 'hr_review'].includes(stageKey))
}

export const STAGE_GUIDES = {
  performance: {
    self_assessment: { time: '10 min', task: 'Complete your performance self-assessment', action: 'Rate each criterion using evidence from the review period.', checklist: ['Review assigned goals and KPIs', 'Add examples for key ratings', 'Identify strengths and development needs'] },
    performance_evaluation: { time: '15 min', task: 'Evaluate performance against role expectations', action: 'Use observed results, safety, service, and operating data.', checklist: ['Review self-assessment', 'Rate logistics KPIs', 'Provide actionable feedback'] },
    calibration: { time: '10 min', task: 'Calibrate performance scores', action: 'Resolve material rating differences and document the decision.', checklist: ['Compare criterion ratings', 'Select the final score approach', 'Record justification'] },
  },
  competency: {
    define_requirements: { time: '10 min', task: 'Set role competency requirements', action: 'Select the correct role benchmark for the logistics position.', checklist: ['Confirm the target role', 'Review competency levels', 'Save required standards'] },
    assign_plan: { time: '10 min', task: 'Address competency gaps', action: 'Assign learning aligned with the employee role and identified gaps.', checklist: ['Review skill gaps', 'Choose relevant learning', 'Set follow-up expectations'] },
  },
  succession: {
    review_readiness: { time: '15 min', task: 'Review candidate readiness', action: 'Use evidence of performance, competencies, and operational experience.', checklist: ['Review role requirements', 'Assess readiness evidence', 'Document development actions'] },
  },
}

export const COMMENT_SUGGESTIONS = QUICK_COMMENTS

export const QUICK_DECISIONS = {
  performance: { approve: 'Performance outcome approved.', return: 'Please revise the evaluation using the notes provided.' },
  succession: { approve: 'Succession plan approved.', return: 'Please provide additional readiness evidence.' },
  recognition: { approve: 'Recognition approved for publication.', return: 'Please update the nomination with the requested evidence.' },
}

export function computeModuleStats(moduleKey, data = {}, workflows = []) {
  const employees = Array.isArray(data.employees) ? data.employees : []
  const totals = data.totals || {}
  const average = key => employees.length
    ? Math.round(employees.reduce((sum, employee) => sum + Number(employee[key] || 0), 0) / employees.length)
    : 0
  const activeWorkflows = workflows.filter(workflow => workflow.status === 'active').length
  const completedWorkflows = workflows.filter(workflow => workflow.status === 'completed').length
  const stats = {
    employeeCount: Number(data.employee_count ?? employees.length),
    averagePerformance: Number(totals.average_performance ?? average('performance_score')),
    averageCompetency: Number(totals.average_competency ?? average('competency_score')),
    learningCompletion: Number(totals.learning_completion ?? average('learning_progress')),
    activeWorkflows,
    completedWorkflows,
  }
  return stats
}

