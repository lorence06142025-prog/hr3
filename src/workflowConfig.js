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
export const LEARNING_CATEGORIES = ['Leadership', 'Customer Service', 'Food Safety', 'Kitchen Operations', 'Compliance', 'Communication', 'Sales', 'Technical Skills']
export const COMPETENCY_CATEGORIES = ['Technical', 'Behavioral', 'Leadership', 'Communication', 'Management', 'Hospitality Service']
export const TRAINING_CATEGORIES = ['Onboarding', 'Compliance', 'Technical', 'Leadership', 'Service Excellence', 'Safety']
export const RECOGNITION_CATEGORIES = ['Customer Obsession', 'Leadership', 'Innovation', 'Service Excellence', 'Teamwork', 'Safety Champion']
export const COMPETENCY_LEVELS = ['Foundation', 'Developing', 'Proficient', 'Expert']
export const SUCCESSION_READINESS = ['Ready Now', 'Ready in 1-2 Years', 'Potential', 'Not Ready']

// KPI library — selecting one auto-fills name, description, weight, target,
// measurement. HR only adjusts the weight/target values.
export const KPI_LIBRARY = [
  // ── General / Cross-department ──────────────────────────────────────────
  { name: 'Customer Satisfaction', department: 'All', description: 'Overall guest satisfaction measured by post-service surveys and online review scores.', weight: 25, target: '90', measurement: 'Survey score (%)' },
  { name: 'Attendance & Punctuality', department: 'All', description: 'Consistent on-time arrival and reliable attendance across the review period.', weight: 15, target: '95', measurement: 'Attendance rate (%)' },
  { name: 'Teamwork & Collaboration', department: 'All', description: 'Constructive cooperation and contribution to team objectives.', weight: 10, target: '90', measurement: 'Peer review score (%)' },
  { name: 'Communication Skills', department: 'All', description: 'Clarity, professionalism, and effectiveness of verbal and written communication.', weight: 10, target: '85', measurement: 'Supervisor assessment (%)' },
  { name: 'Revenue Target Achievement', department: 'All', description: 'Personal or departmental contribution toward revenue targets.', weight: 15, target: '100', measurement: 'Revenue achievement (%)' },
  { name: 'Grooming & Uniform Compliance', department: 'All', description: 'Adherence to hotel grooming standards and proper uniform at all times.', weight: 10, target: '100', measurement: 'Compliance rate (%)' },
  { name: 'Upselling Conversion', department: 'All', description: 'Success rate in converting upsell opportunities for amenities, upgrades, and add-ons.', weight: 15, target: '30', measurement: 'Upsell conversion rate (%)' },

  // ── Food & Beverage ──────────────────────────────────────────────────────
  { name: 'F&B Revenue per Cover', department: 'Food & Beverage', description: 'Average revenue generated per guest cover in the restaurant or banquet.', weight: 20, target: '850', measurement: 'Revenue per cover (PHP)' },
  { name: 'Table Turnover Rate', department: 'Food & Beverage', description: 'Number of times a table is occupied and cleared per service period, maximizing revenue.', weight: 15, target: '3', measurement: 'Turns per service period' },
  { name: 'Order Accuracy', department: 'Food & Beverage', description: 'Percentage of guest orders delivered correctly without modification or complaint.', weight: 20, target: '98', measurement: 'Order accuracy rate (%)' },
  { name: 'Service Speed (F&B)', department: 'Food & Beverage', description: 'Average time from order placement to food delivery.', weight: 15, target: '15', measurement: 'Minutes per order' },
  { name: 'Beverage Cost Control', department: 'Food & Beverage', description: 'Actual beverage cost as a percentage of beverage revenue, within budget.', weight: 15, target: '28', measurement: 'Beverage cost % of revenue' },
  { name: 'Guest Complaint Resolution (F&B)', department: 'Food & Beverage', description: 'Percentage of F&B guest complaints resolved satisfactorily on first contact.', weight: 15, target: '95', measurement: 'Resolution rate (%)' },
  { name: 'Menu Knowledge Score', department: 'Food & Beverage', description: 'Demonstrated knowledge of menu items, allergens, preparation methods, and pairings.', weight: 10, target: '90', measurement: 'Assessment score (%)' },
  { name: 'Banquet Setup Timeliness', department: 'Food & Beverage', description: 'Percentage of banquet events set up fully within the client-specified lead time.', weight: 20, target: '100', measurement: 'On-time setup rate (%)' },
  { name: 'Daily Cover Count', department: 'Food & Beverage', description: 'Total number of guests served per day against daily forecasted covers.', weight: 15, target: '95', measurement: 'Covers vs. forecast (%)' },
  { name: 'Bar Variance / Wastage', department: 'Food & Beverage', description: 'Discrepancy between recorded bar pours and actual inventory used.', weight: 10, target: '2', measurement: 'Variance % (lower is better)' },

  // ── Kitchen / Culinary ───────────────────────────────────────────────────
  { name: 'Food Cost Percentage', department: 'Kitchen', description: 'Total food cost as a percentage of food revenue, reflecting waste control and portioning discipline.', weight: 25, target: '30', measurement: 'Food cost % of revenue' },
  { name: 'Food Quality Audit Score', department: 'Kitchen', description: 'Consistency, presentation, and quality of all food output against hotel standards.', weight: 25, target: '92', measurement: 'Quality audit score (%)' },
  { name: 'HACCP Compliance Rate', department: 'Kitchen', description: 'Adherence to Hazard Analysis and Critical Control Points protocols during food preparation.', weight: 20, target: '100', measurement: 'HACCP audit pass rate (%)' },
  { name: 'Prep Time Efficiency', department: 'Kitchen', description: 'Ability to complete mise en place preparation within standard time benchmarks.', weight: 15, target: '90', measurement: 'On-time prep completion (%)' },
  { name: 'Kitchen Cleanliness Score', department: 'Kitchen', description: 'Condition and cleanliness of kitchen workstation, equipment, and storage areas.', weight: 15, target: '95', measurement: 'Sanitation audit score (%)' },
  { name: 'Recipe Adherence', department: 'Kitchen', description: 'Consistency of dish output against standardized recipes and plating guides.', weight: 20, target: '95', measurement: 'Recipe adherence rate (%)' },
  { name: 'Inventory / Wastage Control', department: 'Kitchen', description: 'Minimization of food spoilage and over-production relative to inventory used.', weight: 15, target: '5', measurement: 'Wastage % of inventory (lower is better)' },
  { name: 'Cross-Contamination Incidents', department: 'Kitchen', description: 'Number of cross-contamination incidents or unsafe food-handling events reported.', weight: 20, target: '0', measurement: 'Incidents (lower is better)' },
  { name: 'Kitchen Output Speed', department: 'Kitchen', description: 'Average time from kitchen ticket receipt to dish delivery to pass.', weight: 15, target: '12', measurement: 'Minutes per ticket' },
  { name: 'Cold Chain Compliance', department: 'Kitchen', description: 'Consistency of proper cold storage temperatures monitored and recorded per shift.', weight: 15, target: '100', measurement: 'Temperature log compliance (%)' },

  // ── Housekeeping ─────────────────────────────────────────────────────────
  { name: 'Room Cleanliness Score', department: 'Housekeeping', description: 'Overall cleanliness and presentation quality of guest rooms as measured by inspection audits.', weight: 30, target: '95', measurement: 'Room inspection score (%)' },
  { name: 'Room Turnover Time', department: 'Housekeeping', description: 'Average time to fully clean and prepare a standard guest room between stays.', weight: 20, target: '25', measurement: 'Minutes per room' },
  { name: 'Amenity Replenishment Accuracy', department: 'Housekeeping', description: 'Accuracy and completeness of in-room amenity replenishment per standard setup sheet.', weight: 15, target: '99', measurement: 'Accuracy rate (%)' },
  { name: 'Guest Satisfaction - Housekeeping', department: 'Housekeeping', description: 'Guest satisfaction scores specifically attributed to room cleanliness and housekeeping service.', weight: 25, target: '90', measurement: 'Guest survey score (%)' },
  { name: 'Linen & Laundry Turnaround', department: 'Housekeeping', description: 'Time from soiled linen collection to clean linen return and room restocking.', weight: 15, target: '4', measurement: 'Hours turnaround time' },
  { name: 'Minibar Accuracy', department: 'Housekeeping', description: 'Accuracy of minibar check and restock relative to guest consumption billing records.', weight: 10, target: '98', measurement: 'Accuracy rate (%)' },
  { name: 'Maintenance Request Reporting', department: 'Housekeeping', description: 'Timely identification and reporting of room maintenance defects discovered during cleaning.', weight: 15, target: '100', measurement: 'Defects reported within 1 shift (%)' },
  { name: 'Chemical Usage Compliance', department: 'Housekeeping', description: 'Correct use of approved cleaning chemicals in proper dilutions per safety and brand standards.', weight: 10, target: '100', measurement: 'Compliance rate (%)' },
  { name: 'Public Area Cleanliness', department: 'Housekeeping', description: 'Cleanliness, tidiness, and presentation of hotel public spaces, corridors, and lobbies.', weight: 20, target: '95', measurement: 'Public area inspection score (%)' },
  { name: 'DND & Guest Privacy Compliance', department: 'Housekeeping', description: 'Adherence to Do Not Disturb protocols and guest privacy policies.', weight: 10, target: '100', measurement: 'Compliance incidents (0 = perfect)' },

  // ── Front Office ─────────────────────────────────────────────────────────
  { name: 'Check-in/Out Efficiency', department: 'Front Office', description: 'Average time to complete a guest check-in or check-out transaction.', weight: 20, target: '5', measurement: 'Minutes per transaction' },
  { name: 'Reservation Accuracy', department: 'Front Office', description: 'Percentage of reservations handled without discrepancy, error, or duplicate booking.', weight: 20, target: '98', measurement: 'Accuracy rate (%)' },
  { name: 'Inventory Accuracy', department: 'Front Office', description: 'Accuracy of room inventory records and stock levels.', weight: 10, target: '95', measurement: 'Accuracy rate (%)' },
]


// Learning template library — selecting one auto-fills title, description,
// objectives, duration, category. Users only edit if needed.
export const LEARNING_TEMPLATES = [
  { title: 'Leadership Training', category: 'Leadership', duration: '8', description: 'Develop core leadership and people-management capabilities for emerging leaders.', objectives: 'Lead a team effectively; give constructive feedback; delegate and motivate; make decisions with confidence.' },
  { title: 'Customer Service Excellence', category: 'Customer Service', duration: '4', description: 'Deliver memorable, service-first experiences that exceed guest expectations.', objectives: 'Handle guest requests proactively; resolve complaints with empathy; up-sell and cross-sell; maintain service standards.' },
  { title: 'Kitchen Hygiene', category: 'Food Safety', duration: '3', description: 'Maintain strict kitchen hygiene and food-safety standards.', objectives: 'Follow HACCP guidelines; prevent cross-contamination; store food correctly; maintain a clean workstation.' },
  { title: 'Food Safety', category: 'Food Safety', duration: '5', description: 'Understand and apply food-safety regulations across the operation.', objectives: 'Identify food-safety hazards; control critical points; document compliance; respond to incidents.' },
  { title: 'Front Desk Excellence', category: 'Customer Service', duration: '4', description: 'Deliver a polished, professional front-desk experience.', objectives: 'Manage check-in/out smoothly; handle reservations; resolve guest issues; represent the brand.' },
  { title: 'Conflict Resolution', category: 'Communication', duration: '3', description: 'Resolve workplace and guest conflicts constructively.', objectives: 'De-escalate tense situations; listen actively; find win-win outcomes; escalate appropriately.' },
  { title: 'Cash Handling', category: 'Compliance', duration: '2', description: 'Handle cash and POS transactions accurately and securely.', objectives: 'Process payments correctly; reconcile the till; detect fraud; follow cash policies.' },
  { title: 'Emergency Procedures', category: 'Compliance', duration: '2', description: 'Respond correctly to emergencies and safety incidents.', objectives: 'Know evacuation routes; use fire equipment; report incidents; protect guests and staff.' },
]

// Mapping linking competency categories/names to recommended learning template categories
export const COMPETENCY_LEARNING_MAP = {
  // Front Office & Guest Service
  'Customer Service': ['Customer Service Excellence', 'Front Desk Excellence'],
  'Hospitality Service': ['Customer Service Excellence', 'Front Desk Excellence'],
  'Guest Service': ['Customer Service Excellence', 'Front Desk Excellence'],
  'Guest Satisfaction': ['Customer Service Excellence', 'Front Desk Excellence'],
  'Communication': ['Front Desk Excellence', 'Conflict Resolution'],
  'Multilingual Communication': ['Front Desk Excellence', 'Conflict Resolution'],
  'Reservation Management': ['Front Desk Excellence', 'Customer Service Excellence'],
  'PMS & Reservation Control': ['Front Desk Excellence'],
  'Guest Relations & VIP Protocol': ['Front Desk Excellence', 'Customer Service Excellence'],
  'VIP Guest Etiquette': ['Customer Service Excellence', 'Front Desk Excellence'],
  'VIP Guest Logistics & Transport': ['Front Desk Excellence', 'Customer Service Excellence'],
  'Local & Destination Mastery': ['Front Desk Excellence', 'Customer Service Excellence'],
  'Vendor & Experience Networking': ['Customer Service Excellence', 'Front Desk Excellence'],
  'Conflict Resolution': ['Conflict Resolution'],
  'Hospitality SOP Compliance': ['Emergency Procedures', 'Front Desk Excellence'],

  // Leadership & Management
  'Leadership': ['Leadership Training'],
  'Team Leadership': ['Leadership Training'],
  'Team Leadership & Rostering': ['Leadership Training'],
  'Team Supervision & Training': ['Leadership Training'],
  'Kitchen Brigade Leadership': ['Leadership Training'],
  'Junior Cook Mentorship': ['Leadership Training'],
  'Staff Mentorship & Briefings': ['Leadership Training'],
  'Staff Coaching & Tasting': ['Leadership Training'],
  'Pastry Brigade Coordination': ['Leadership Training'],
  'Department Leadership & Culture': ['Leadership Training'],
  'Operational Management': ['Leadership Training'],
  'Multi-Outlet Operational Excellence': ['Leadership Training'],
  'Employee Relations': ['Leadership Training', 'Conflict Resolution'],
  'Team Collaboration': ['Conflict Resolution', 'Leadership Training'],

  // Kitchen & Culinary & Food Safety
  'Food Safety': ['Kitchen Hygiene', 'Food Safety'],
  'HACCP & Kitchen Sanitation': ['Kitchen Hygiene', 'Food Safety'],
  'HACCP & Food Safety Mastery': ['Food Safety', 'Kitchen Hygiene'],
  'Kitchen Hygiene': ['Kitchen Hygiene', 'Food Safety'],
  'Hygiene & Safety': ['Kitchen Hygiene', 'Food Safety'],
  'Hygiene & Health Standards': ['Kitchen Hygiene', 'Food Safety'],
  'Sanitation & Bar Maintenance': ['Kitchen Hygiene', 'Food Safety'],
  'Temperature & Food Safety': ['Kitchen Hygiene', 'Food Safety'],
  'Food Safety & Brand Standards': ['Food Safety', 'Kitchen Hygiene'],
  'Culinary Skill': ['Kitchen Hygiene', 'Food Safety'],
  'Advanced Culinary Artistry': ['Kitchen Hygiene', 'Food Safety'],
  'Kitchen Operations': ['Kitchen Hygiene', 'Food Safety'],
  'Line Expediting & Speed': ['Kitchen Hygiene', 'Food Safety'],
  'Recipe Consistency & Flavor': ['Kitchen Hygiene', 'Food Safety'],
  'Baking & Pastry Techniques': ['Kitchen Hygiene', 'Food Safety'],
  'Dessert Plating & Artistry': ['Kitchen Hygiene', 'Food Safety'],
  'Recipe Scaling & Waste Reduction': ['Kitchen Hygiene', 'Food Safety'],
  'Food & Wine Pairing': ['Customer Service Excellence', 'Food Safety'],
  'Wine & Beverage Master': ['Customer Service Excellence'],
  'Craft Cocktail Mixology': ['Customer Service Excellence'],
  'Bar Speed & Multitasking': ['Customer Service Excellence'],
  'Floor Operations & Speed': ['Customer Service Excellence'],

  // Housekeeping & Facilities
  'Room Standards & Inspection': ['Emergency Procedures', 'Compliance'],
  'Chemical & Bio-Safety Compliance': ['Emergency Procedures'],
  'Turnaround Time Optimization': ['Emergency Procedures'],
  'Linen & Inventory Management': ['Emergency Procedures', 'Cash Handling'],

  // Finance, Compliance & Operations
  'Compliance': ['Emergency Procedures', 'Cash Handling'],
  'Discretion & Privacy Compliance': ['Emergency Procedures'],
  'Alcohol Compliance & Verification': ['Emergency Procedures'],
  'Safety & Emergency Procedures': ['Emergency Procedures'],
  'Financial Acumen': ['Cash Handling'],
  'POS & Cash Reconciliation': ['Cash Handling'],
  'Beverage Cost Control': ['Cash Handling'],
  'Menu Engineering & Costing': ['Cash Handling'],
  'Strategic P&L & Revenue Mgmt': ['Cash Handling'],
  'Night Audit & Revenue Tracking': ['Cash Handling'],
  'Data & Payroll': ['Cash Handling'],
  'Cellar & Inventory Control': ['Cash Handling'],
  'Supplier & Inventory Control': ['Cash Handling'],
  'Prep & Station Inventory': ['Kitchen Hygiene'],
  'Quality & Speed Audits': ['Leadership Training'],
  'Supplier Contract Negotiations': ['Leadership Training', 'Conflict Resolution'],
  'Recruitment': ['Leadership Training'],
}

export function getRecommendedCoursesForGap(competencyName, score = 0) {
  const norm = String(competencyName || '').trim()
  const matchedTitles = COMPETENCY_LEARNING_MAP[norm] || []
  
  let matches = LEARNING_TEMPLATES.filter(t => matchedTitles.includes(t.title))
  if (matches.length === 0) {
    // Partial search fallback across titles & categories
    matches = LEARNING_TEMPLATES.filter(t => 
      t.category.toLowerCase().includes(norm.toLowerCase()) || 
      t.title.toLowerCase().includes(norm.toLowerCase()) ||
      norm.toLowerCase().includes(t.category.toLowerCase()) ||
      norm.toLowerCase().includes(t.title.toLowerCase())
    )
  }
  if (matches.length === 0) {
    // Context-aware default based on keywords in the competency name
    const normLower = norm.toLowerCase()
    if (normLower.includes('food') || normLower.includes('kitchen') || normLower.includes('haccp') || normLower.includes('sanitation') || normLower.includes('hygiene') || normLower.includes('recipe') || normLower.includes('culinary')) {
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Kitchen Hygiene') || LEARNING_TEMPLATES[2]]
    } else if (normLower.includes('lead') || normLower.includes('manage') || normLower.includes('supervis') || normLower.includes('coach') || normLower.includes('mentor')) {
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Leadership Training') || LEARNING_TEMPLATES[0]]
    } else if (normLower.includes('cash') || normLower.includes('audit') || normLower.includes('cost') || normLower.includes('financ') || normLower.includes('revenue') || normLower.includes('payroll')) {
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Cash Handling') || LEARNING_TEMPLATES[6]]
    } else if (normLower.includes('conflict') || normLower.includes('communicat')) {
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Conflict Resolution') || LEARNING_TEMPLATES[5]]
    } else if (normLower.includes('compliance') || normLower.includes('safety') || normLower.includes('emergency')) {
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Emergency Procedures') || LEARNING_TEMPLATES[7]]
    } else {
      // Front Office / Customer Service default
      matches = [LEARNING_TEMPLATES.find(t => t.title === 'Front Desk Excellence') || LEARNING_TEMPLATES[1]]
    }
  }
  return matches
}

// ---------------------------------------------------------------------------
// Pre-built & Dynamic AI Curricula for Hospitality Learning Resources
// ---------------------------------------------------------------------------
export const AI_CURRICULUM_LIBRARY = {
  'customer service': `# Module 1: Foundations of Hospitality Excellence
- **The Service Mindset**: Anticipating guest needs before being asked and taking ownership of guest comfort.
- **The 10-5 Hospitality Standard**: Maintain eye contact and a warm smile at 10 feet; deliver a clear verbal greeting at 5 feet.
- **Professional Presence**: Impeccable grooming, upright posture, and approachable, welcoming body language.

# Module 2: Effective Communication & Etiquette
- **Tone & Active Listening**: Listen without interrupting, take notes for complex requests, and summarize back to confirm understanding.
- **Positive Language**: Replace "I can't do that" with "Here is what I can do for you right now."
- **Telephone & Messaging Etiquette**: Answer within 3 rings with a warm greeting, personal name, and department.

# Module 3: Service Recovery & The LAST Framework
- **L - Listen**: Hear the guest out fully with genuine empathy, patience, and non-defensive posture.
- **A - Apologize**: Acknowledge the frustration sincerely without making excuses or blaming colleagues.
- **S - Solve**: Propose an immediate, practical solution and verify that the guest agrees with the resolution.
- **T - Thank**: Express appreciation for their feedback, which helps our team continually elevate standards.

# Module 4: Upselling & Experience Personalization
- **Organic Recommendations**: Suggest pairings, specials, and local amenities naturally based on guest preferences.
- **Delighting VIP & Returning Guests**: Recognize loyalty members, remember past preferences, and add thoughtful personalized touches.

# Key Takeaways & Best Practices
> "Hospitality is not just a department—it is the art of making guests feel genuinely valued through attention to detail and consistent warmth."`,

  'leadership': `# Module 1: Shift Leadership & Daily Briefings
- **Pre-Shift Huddles**: Setting clear daily covers and revenue targets, reviewing VIP arrivals, and motivating the team.
- **Effective Delegation**: Assigning station responsibilities based on individual strengths and volume peaks.

# Module 2: Constructive Feedback & 1-on-1 Coaching
- **The SBI Model**: Situation, Behavior, and Impact feedback delivered privately, constructively, and promptly.
- **Encouraging Peer Recognition**: Fostering a supportive team culture where effort is noticed and celebrated.

# Module 3: Operational Problem Solving & Escalation
- **Peak Hour Management**: Managing bottlenecks at reception, floor, or kitchen pass under high pressure.
- **Inter-Department Harmony**: Seamless coordination between Front of House, Back of House, and Housekeeping.

# Module 4: Performance Standards & Compliance
- **Auditing SOPs**: Conducting regular spot checks on brand standards, hygiene, and guest satisfaction scores.
- **Developing Talent**: Identifying high-potential team members and mentoring them into supervisory roles.

# Key Takeaways & Best Practices
> "A great leader doesn't just manage shifts—they build confidence, uphold standards, and inspire their team to excel."`,

  'food safety': `# Module 1: HACCP & Critical Control Points
- **Temperature Danger Zone**: Maintaining cold food strictly below 4°C (40°F) and hot holding above 60°C (140°F).
- **Temperature Logging**: Mandatory calibration of probe thermometers and scheduled hourly log entries.

# Module 2: Cross-Contamination & Allergen Isolation
- **Color-Coded Board System**: Red (raw meat), Blue (raw fish), Yellow (cooked meat), Green (produce), White (bakery/dairy).
- **Allergen Protocols**: Strict separation of utensils, pans, and prep areas for top 14 allergen requests.

# Module 3: Hygiene, Sanitization & Chemical Safety
- **Handwashing Standards**: 20-second thorough wash using warm water, antimicrobial soap, and single-use paper towels.
- **Sanitizing Workstations**: 3-sink method (wash, rinse, sanitize) with calibrated PPM test strips.

# Module 4: Food Storage & FIFO Rotation
- **FIFO (First In, First Out)**: Clear dating, labeling, and shelf placement (raw poultry on lowest shelves).
- **Receiving & Inspection**: Rejecting compromised packaging, dented cans, or out-of-spec delivery temperatures.

# Key Takeaways & Best Practices
> "Food safety is non-negotiable—every guest trusts our kitchen with their health and well-being."`,

  'conflict resolution': `# Module 1: De-Escalation & Emotion Management
- **Staying Composed**: Maintaining a steady, calm tone of voice and relaxed non-confrontational posture.
- **Separating Emotion from Facts**: Acknowledging the guest's emotion while focusing on the actionable solution.

# Module 2: The Empathy-First Dialogue
- **Empathetic Phrases**: "I completely understand why this is frustrating for you, and I am here to fix it."
- **Avoiding Escalation Triggers**: Eliminating phrases like "You should have known" or "That's company policy."

# Module 3: Collaborative Resolution & Options
- **Presenting 2-3 Clear Choices**: Giving the guest agency in deciding how they would like the issue resolved.
- **Empowered Service Recovery**: Offering appropriate compensation, complimentary amenities, or room adjustments.

# Module 4: Incident Logging & Team Debriefing
- **Duty Manager Handover**: Recording detailed notes on the incident log for shift continuity.
- **Root Cause Prevention**: Reviewing recurring complaints to improve training and operational workflows.

# Key Takeaways & Best Practices
> "Conflict handled with professionalism and grace turns our most frustrated guests into our most loyal advocates."`
}

export function getAiCurriculumForCourse(resource = {}) {
  const title = (resource.title || '').toLowerCase()
  const cat = (resource.category || '').toLowerCase()
  const desc = (resource.description || '').toLowerCase()

  if (title.includes('customer') || title.includes('service') || cat.includes('customer') || desc.includes('customer') || desc.includes('servicing')) {
    return AI_CURRICULUM_LIBRARY['customer service']
  }
  if (title.includes('leader') || cat.includes('leader') || desc.includes('leader') || title.includes('supervis')) {
    return AI_CURRICULUM_LIBRARY['leadership']
  }
  if (title.includes('food') || title.includes('hygiene') || title.includes('haccp') || cat.includes('food') || desc.includes('safety')) {
    return AI_CURRICULUM_LIBRARY['food safety']
  }
  if (title.includes('conflict') || title.includes('communicat') || cat.includes('communicat')) {
    return AI_CURRICULUM_LIBRARY['conflict resolution']
  }

  // Dynamic fallback tailored to the course metadata
  const courseName = resource.title || 'Professional Hospitality Training'
  return `# Module 1: Core Fundamentals & Principles
- **Introduction to ${courseName}**: Industry benchmarks and hospitality standards.
- **Key Roles & Responsibilities**: Understanding the standard operating procedures.
- **Tooling & Standard Practices**: Essential equipment, workflows, and quality checks.

# Module 2: Step-by-Step Practical Application
- **Operational Execution**: Applying standard techniques in live daily shifts.
- **Efficiency & Quality Assurance**: Maintaining speed without compromising precision.
- **Inter-Department Collaboration**: Communicating effectively with shift teams and management.

# Module 3: Troubleshooting & Exception Handling
- **Common Obstacles**: Identifying frequent bottlenecks or service errors early.
- **Root Cause Problem Solving**: Taking proactive corrective actions immediately.
- **Escalation Guidelines**: Knowing when and how to report issues to the supervisor.

# Module 4: Continuous Improvement & Assessment
- **Reviewing Results**: Comparing outcomes against required competency KPIs.
- **Action Plan**: Setting daily development targets for ongoing mastery.

# Key Takeaways & Best Practices
> "Mastery in ${courseName} requires consistent practice, attention to detail, and a passion for hospitality excellence."`
}

// Competency template library — selecting a position auto-loads required
// competencies, suggested proficiency levels and weights.
// Competency template library — centralized role dictionary with predefined
// required competency benchmarks, target levels, categories, and weights.
export const COMPETENCY_TEMPLATES = {
  'Head Sommelier': [
    { competency: 'Wine & Beverage Master', level: 'Expert', weight: 25, category: 'Hospitality Service', targetScore: 98 },
    { competency: 'Food & Wine Pairing', level: 'Expert', weight: 20, category: 'Technical', targetScore: 95 },
    { competency: 'Cellar & Inventory Control', level: 'Proficient', weight: 20, category: 'Operations', targetScore: 88 },
    { competency: 'VIP Guest Etiquette', level: 'Expert', weight: 15, category: 'Hospitality Service', targetScore: 95 },
    { competency: 'Beverage Cost Control', level: 'Proficient', weight: 10, category: 'Financial Acumen', targetScore: 85 },
    { competency: 'Staff Coaching & Tasting', level: 'Proficient', weight: 10, category: 'Leadership', targetScore: 85 },
  ],
  'Front Office Manager': [
    { competency: 'Guest Relations & VIP Protocol', level: 'Expert', weight: 25, category: 'Hospitality Service', targetScore: 98 },
    { competency: 'PMS & Reservation Control', level: 'Expert', weight: 20, category: 'Technical', targetScore: 95 },
    { competency: 'Conflict Resolution', level: 'Expert', weight: 20, category: 'Communication', targetScore: 95 },
    { competency: 'Team Leadership & Rostering', level: 'Proficient', weight: 15, category: 'Leadership', targetScore: 88 },
    { competency: 'Night Audit & Revenue Tracking', level: 'Proficient', weight: 10, category: 'Financial Acumen', targetScore: 85 },
    { competency: 'Safety & Emergency Procedures', level: 'Proficient', weight: 10, category: 'Compliance', targetScore: 88 },
  ],
  'Executive Chef': [
    { competency: 'Advanced Culinary Artistry', level: 'Expert', weight: 25, category: 'Technical', targetScore: 98 },
    { competency: 'Menu Engineering & Costing', level: 'Expert', weight: 20, category: 'Financial Acumen', targetScore: 95 },
    { competency: 'Kitchen Brigade Leadership', level: 'Expert', weight: 20, category: 'Leadership', targetScore: 95 },
    { competency: 'HACCP & Food Safety Mastery', level: 'Expert', weight: 15, category: 'Food Safety', targetScore: 98 },
    { competency: 'Supplier & Inventory Control', level: 'Proficient', weight: 10, category: 'Operations', targetScore: 88 },
    { competency: 'Quality & Speed Audits', level: 'Proficient', weight: 10, category: 'Operations', targetScore: 90 },
  ],
  'Restaurant Supervisor': [
    { competency: 'Floor Operations & Speed', level: 'Expert', weight: 25, category: 'Operations', targetScore: 95 },
    { competency: 'Guest Satisfaction', level: 'Expert', weight: 25, category: 'Hospitality Service', targetScore: 95 },
    { competency: 'Staff Mentorship & Briefings', level: 'Proficient', weight: 20, category: 'Leadership', targetScore: 88 },
    { competency: 'POS & Cash Reconciliation', level: 'Proficient', weight: 15, category: 'Financial Acumen', targetScore: 85 },
    { competency: 'Hygiene & Health Standards', level: 'Proficient', weight: 15, category: 'Food Safety', targetScore: 88 },
  ],
  'Housekeeping Executive': [
    { competency: 'Room Standards & Inspection', level: 'Expert', weight: 30, category: 'Technical', targetScore: 95 },
    { competency: 'Chemical & Bio-Safety Compliance', level: 'Expert', weight: 20, category: 'Compliance', targetScore: 95 },
    { competency: 'Linen & Inventory Management', level: 'Proficient', weight: 20, category: 'Operations', targetScore: 88 },
    { competency: 'Turnaround Time Optimization', level: 'Proficient', weight: 15, category: 'Operations', targetScore: 85 },
    { competency: 'Team Supervision & Training', level: 'Proficient', weight: 15, category: 'Leadership', targetScore: 85 },
  ],
  'Bartender / Mixologist': [
    { competency: 'Craft Cocktail Mixology', level: 'Expert', weight: 30, category: 'Technical', targetScore: 95 },
    { competency: 'Bar Speed & Multitasking', level: 'Proficient', weight: 25, category: 'Operations', targetScore: 88 },
    { competency: 'Guest Engagement & Upselling', level: 'Proficient', weight: 20, category: 'Hospitality Service', targetScore: 85 },
    { competency: 'Alcohol Compliance & Verification', level: 'Expert', weight: 15, category: 'Compliance', targetScore: 95 },
    { competency: 'Sanitation & Bar Maintenance', level: 'Proficient', weight: 10, category: 'Food Safety', targetScore: 88 },
  ],
  'Pastry Chef': [
    { competency: 'Baking & Pastry Techniques', level: 'Expert', weight: 30, category: 'Technical', targetScore: 95 },
    { competency: 'Dessert Plating & Artistry', level: 'Expert', weight: 25, category: 'Technical', targetScore: 92 },
    { competency: 'Temperature & Food Safety', level: 'Expert', weight: 20, category: 'Food Safety', targetScore: 95 },
    { competency: 'Recipe Scaling & Waste Reduction', level: 'Proficient', weight: 15, category: 'Operations', targetScore: 85 },
    { competency: 'Pastry Brigade Coordination', level: 'Developing', weight: 10, category: 'Leadership', targetScore: 75 },
  ],
  'Concierge Manager': [
    { competency: 'Local & Destination Mastery', level: 'Expert', weight: 30, category: 'Hospitality Service', targetScore: 98 },
    { competency: 'VIP Guest Logistics & Transport', level: 'Expert', weight: 25, category: 'Operations', targetScore: 95 },
    { competency: 'Multilingual Communication', level: 'Proficient', weight: 20, category: 'Communication', targetScore: 88 },
    { competency: 'Vendor & Experience Networking', level: 'Proficient', weight: 15, category: 'Relationship Management', targetScore: 85 },
    { competency: 'Discretion & Privacy Compliance', level: 'Expert', weight: 10, category: 'Compliance', targetScore: 95 },
  ],
  'F&B Director': [
    { competency: 'Strategic P&L & Revenue Mgmt', level: 'Expert', weight: 30, category: 'Financial Acumen', targetScore: 95 },
    { competency: 'Multi-Outlet Operational Excellence', level: 'Expert', weight: 25, category: 'Operations', targetScore: 95 },
    { competency: 'Department Leadership & Culture', level: 'Expert', weight: 20, category: 'Leadership', targetScore: 95 },
    { competency: 'Food Safety & Brand Standards', level: 'Proficient', weight: 15, category: 'Compliance', targetScore: 90 },
    { competency: 'Supplier Contract Negotiations', level: 'Proficient', weight: 10, category: 'Operations', targetScore: 85 },
  ],
  'Sous Chef': [
    { competency: 'Line Expediting & Speed', level: 'Expert', weight: 30, category: 'Operations', targetScore: 95 },
    { competency: 'Recipe Consistency & Flavor', level: 'Expert', weight: 25, category: 'Technical', targetScore: 95 },
    { competency: 'HACCP & Kitchen Sanitation', level: 'Expert', weight: 20, category: 'Food Safety', targetScore: 95 },
    { competency: 'Junior Cook Mentorship', level: 'Proficient', weight: 15, category: 'Leadership', targetScore: 88 },
    { competency: 'Prep & Station Inventory', level: 'Proficient', weight: 10, category: 'Operations', targetScore: 85 },
  ],
  'Restaurant Manager': [
    { competency: 'Operational Management', level: 'Expert', weight: 30, category: 'Operations', targetScore: 95 },
    { competency: 'Financial Acumen', level: 'Proficient', weight: 20, category: 'Financial Acumen', targetScore: 88 },
    { competency: 'Leadership', level: 'Expert', weight: 25, category: 'Leadership', targetScore: 95 },
    { competency: 'Customer Service', level: 'Proficient', weight: 15, category: 'Hospitality Service', targetScore: 88 },
    { competency: 'Food Safety', level: 'Proficient', weight: 10, category: 'Food Safety', targetScore: 88 },
  ],
  'Front Desk Officer': [
    { competency: 'Customer Service', level: 'Expert', weight: 30, category: 'Hospitality Service', targetScore: 95 },
    { competency: 'Communication', level: 'Proficient', weight: 25, category: 'Communication', targetScore: 88 },
    { competency: 'Reservation Management', level: 'Proficient', weight: 20, category: 'Technical', targetScore: 88 },
    { competency: 'Conflict Resolution', level: 'Developing', weight: 15, category: 'Communication', targetScore: 75 },
    { competency: 'Compliance', level: 'Foundation', weight: 10, category: 'Compliance', targetScore: 60 },
  ],
  'HR Staff': [
    { competency: 'Employee Relations', level: 'Proficient', weight: 25, category: 'Leadership', targetScore: 88 },
    { competency: 'Recruitment', level: 'Proficient', weight: 20, category: 'Operations', targetScore: 88 },
    { competency: 'Compliance', level: 'Proficient', weight: 20, category: 'Compliance', targetScore: 88 },
    { competency: 'Communication', level: 'Developing', weight: 20, category: 'Communication', targetScore: 75 },
    { competency: 'Data & Payroll', level: 'Developing', weight: 15, category: 'Financial Acumen', targetScore: 75 },
  ],
  // Executive Office
  'General Manager': [
    { competency: 'Strategic Leadership & Vision', level: 'Expert', weight: 30, category: 'Leadership', targetScore: 98 },
    { competency: 'Financial & Asset Management', level: 'Expert', weight: 25, category: 'Financial Acumen', targetScore: 95 },
    { competency: 'Executive Operations & Governance', level: 'Expert', weight: 20, category: 'Operations', targetScore: 95 },
    { competency: 'Stakeholder & Board Relations', level: 'Expert', weight: 15, category: 'Relationship Management', targetScore: 95 },
    { competency: 'Crisis & Risk Management', level: 'Expert', weight: 10, category: 'Compliance', targetScore: 95 },
  ],
  'Operations Manager': [
    { competency: 'Cross-Departmental Coordination', level: 'Expert', weight: 30, category: 'Operations', targetScore: 95 },
    { competency: 'Resource Allocation & Efficiency', level: 'Proficient', weight: 25, category: 'Operations', targetScore: 90 },
    { competency: 'Operational Strategy & SOP Compliance', level: 'Expert', weight: 20, category: 'Compliance', targetScore: 92 },
    { competency: 'Performance Monitoring & Analytics', level: 'Proficient', weight: 15, category: 'Technical', targetScore: 88 },
    { competency: 'Team Leadership & Mentorship', level: 'Proficient', weight: 10, category: 'Leadership', targetScore: 88 },
  ],

  // Security
  'Director of Security': [
    { competency: 'Crisis Management & Evacuation', level: 'Expert', weight: 30, category: 'Compliance', targetScore: 95 },
    { competency: 'Incident Response & Safety', level: 'Expert', weight: 25, category: 'Operations', targetScore: 95 },
    { competency: 'Security Risk & Threat Assessment', level: 'Expert', weight: 20, category: 'Technical', targetScore: 92 },
    { competency: 'Executive Leadership & Governance', level: 'Expert', weight: 15, category: 'Leadership', targetScore: 90 },
    { competency: 'Emergency SOP & Law Liaison', level: 'Proficient', weight: 10, category: 'Compliance', targetScore: 88 },
  ],
  'Security Supervisor': [
    { competency: 'Patrol & Dispatch Supervision', level: 'Expert', weight: 30, category: 'Operations', targetScore: 90 },
    { competency: 'Surveillance Systems Monitoring', level: 'Expert', weight: 25, category: 'Technical', targetScore: 88 },
    { competency: 'Incident Response & Escalation', level: 'Expert', weight: 20, category: 'Compliance', targetScore: 90 },
    { competency: 'Shift Leadership & Guard Mentorship', level: 'Proficient', weight: 15, category: 'Leadership', targetScore: 85 },
    { competency: 'Safety & Emergency Protocols', level: 'Proficient', weight: 10, category: 'Compliance', targetScore: 88 },
  ],
  'CCTV & Patrol Officer': [
    { competency: 'Surveillance Systems Operation', level: 'Proficient', weight: 30, category: 'Technical', targetScore: 85 },
    { competency: 'Premises Patrol & Inspection', level: 'Proficient', weight: 30, category: 'Operations', targetScore: 85 },
    { competency: 'Incident Reporting & Logging', level: 'Proficient', weight: 20, category: 'Communication', targetScore: 82 },
    { competency: 'Access Control & Visitor Safety', level: 'Proficient', weight: 20, category: 'Compliance', targetScore: 82 },
  ],

  // Engineering
  'Chief Engineer': [
    { competency: 'Facilities Management & Sustainability', level: 'Expert', weight: 30, category: 'Operations', targetScore: 95 },
    { competency: 'HVAC & Heavy Mechanical Systems', level: 'Expert', weight: 25, category: 'Technical', targetScore: 92 },
    { competency: 'Capital Project & Vendor Management', level: 'Expert', weight: 20, category: 'Financial Acumen', targetScore: 90 },
    { competency: 'Engineering Financial Acumen', level: 'Proficient', weight: 15, category: 'Financial Acumen', targetScore: 88 },
    { competency: 'Safety & OSHA Compliance', level: 'Expert', weight: 10, category: 'Compliance', targetScore: 95 },
  ],
  'Assistant Chief Engineer': [
    { competency: 'Mechanical & Electrical Maintenance', level: 'Expert', weight: 30, category: 'Technical', targetScore: 90 },
    { competency: 'Preventive Maintenance Scheduling', level: 'Expert', weight: 25, category: 'Operations', targetScore: 88 },
    { competency: 'Crew Supervision & Work Orders', level: 'Proficient', weight: 20, category: 'Leadership', targetScore: 85 },
    { competency: 'Energy & Utility Efficiency', level: 'Proficient', weight: 15, category: 'Operations', targetScore: 85 },
    { competency: 'Emergency Safety Protocols', level: 'Proficient', weight: 10, category: 'Compliance', targetScore: 88 },
  ],
  'HVAC & Maintenance Tech': [
    { competency: 'HVAC & Technical Maintenance', level: 'Proficient', weight: 35, category: 'Technical', targetScore: 85 },
    { competency: 'Preventive Equipment Servicing', level: 'Proficient', weight: 30, category: 'Operations', targetScore: 85 },
    { competency: 'Workplace Safety & OSHA', level: 'Proficient', weight: 20, category: 'Compliance', targetScore: 85 },
    { competency: 'Tool & Inventory Care', level: 'Foundation', weight: 15, category: 'Operations', targetScore: 75 },
  ],

  // Sales & Marketing
  'Director of Sales': [
    { competency: 'Revenue Strategy & Yield Management', level: 'Expert', weight: 30, category: 'Financial Acumen', targetScore: 95 },
    { competency: 'Negotiation & Contracting', level: 'Expert', weight: 25, category: 'Relationship Management', targetScore: 95 },
    { competency: 'Commercial Client Relationships', level: 'Expert', weight: 20, category: 'Hospitality Service', targetScore: 92 },
    { competency: 'Sales Team Leadership', level: 'Expert', weight: 15, category: 'Leadership', targetScore: 90 },
    { competency: 'Market Analysis & Digital Campaigns', level: 'Proficient', weight: 10, category: 'Operations', targetScore: 88 },
  ],
  'Sales Manager': [
    { competency: 'Corporate Account Management', level: 'Expert', weight: 30, category: 'Relationship Management', targetScore: 90 },
    { competency: 'Contract Negotiation & Closing', level: 'Expert', weight: 25, category: 'Financial Acumen', targetScore: 88 },
    { competency: 'Client Communication & Pitching', level: 'Expert', weight: 25, category: 'Communication', targetScore: 90 },
    { competency: 'Sales Pipeline Tracking', level: 'Proficient', weight: 20, category: 'Operations', targetScore: 85 },
  ],
  'Events & Banquet Coordinator': [
    { competency: 'Event Planning & Execution', level: 'Expert', weight: 35, category: 'Operations', targetScore: 90 },
    { competency: 'Client Relationship Management', level: 'Proficient', weight: 30, category: 'Hospitality Service', targetScore: 88 },
    { competency: 'Banquet Logistics & BEO Coordination', level: 'Proficient', weight: 20, category: 'Technical', targetScore: 85 },
    { competency: 'Communication & Team Sync', level: 'Proficient', weight: 15, category: 'Communication', targetScore: 85 },
  ],

  // Finance
  'Financial Controller': [
    { competency: 'Financial Reporting & USALI', level: 'Expert', weight: 30, category: 'Financial Acumen', targetScore: 98 },
    { competency: 'Internal Controls & Compliance', level: 'Expert', weight: 25, category: 'Compliance', targetScore: 95 },
    { competency: 'Strategic Budgeting & Forecasting', level: 'Expert', weight: 20, category: 'Financial Acumen', targetScore: 95 },
    { competency: 'Finance Team Leadership', level: 'Expert', weight: 15, category: 'Leadership', targetScore: 90 },
    { competency: 'Asset & Cash Risk Management', level: 'Expert', weight: 10, category: 'Operations', targetScore: 92 },
  ],
  'Assistant Financial Controller': [
    { competency: 'Financial Audit & USALI Standards', level: 'Expert', weight: 30, category: 'Financial Acumen', targetScore: 92 },
    { competency: 'Account Reconciliation & Ledger', level: 'Expert', weight: 25, category: 'Financial Acumen', targetScore: 90 },
    { competency: 'General Ledger & Closing', level: 'Proficient', weight: 20, category: 'Technical', targetScore: 88 },
    { competency: 'Audit Team Supervision', level: 'Proficient', weight: 15, category: 'Leadership', targetScore: 85 },
    { competency: 'Variance Analysis', level: 'Proficient', weight: 10, category: 'Financial Acumen', targetScore: 85 },
  ],
  'Senior General Accountant': [
    { competency: 'General Ledger & Tax Accounting', level: 'Expert', weight: 35, category: 'Financial Acumen', targetScore: 90 },
    { competency: 'AP/AR & Bank Reconciliation', level: 'Expert', weight: 30, category: 'Technical', targetScore: 88 },
    { competency: 'Internal Audit Compliance', level: 'Proficient', weight: 20, category: 'Compliance', targetScore: 85 },
    { competency: 'Financial Reporting Accuracy', level: 'Proficient', weight: 15, category: 'Communication', targetScore: 85 },
  ],

  // Additional Housekeeping & Human Resources
  'Housekeeping Supervisor': [
    { competency: 'Floor Quality & Room Inspections', level: 'Expert', weight: 35, category: 'Technical', targetScore: 90 },
    { competency: 'Shift Duty Rostering', level: 'Proficient', weight: 25, category: 'Operations', targetScore: 85 },
    { competency: 'Chemical & Bio-Safety', level: 'Expert', weight: 20, category: 'Compliance', targetScore: 90 },
    { competency: 'Attendant Mentorship', level: 'Proficient', weight: 20, category: 'Leadership', targetScore: 85 },
  ],
  'Room Attendant': [
    { competency: 'Room Cleaning & Sanitation', level: 'Proficient', weight: 40, category: 'Technical', targetScore: 85 },
    { competency: 'Linen & Amenities Stocking', level: 'Proficient', weight: 25, category: 'Operations', targetScore: 82 },
    { competency: 'Chemical Safety Compliance', level: 'Proficient', weight: 20, category: 'Compliance', targetScore: 85 },
    { competency: 'Turnaround Speed', level: 'Developing', weight: 15, category: 'Operations', targetScore: 78 },
  ],
  'HR Manager': [
    { competency: 'Strategic Talent & Workforce Planning', level: 'Expert', weight: 30, category: 'Leadership', targetScore: 92 },
    { competency: 'Labor Law & Statutory Compliance', level: 'Expert', weight: 25, category: 'Compliance', targetScore: 95 },
    { competency: 'Employee Relations & Culture', level: 'Expert', weight: 20, category: 'Leadership', targetScore: 90 },
    { competency: 'HR Team Supervision', level: 'Proficient', weight: 15, category: 'Operations', targetScore: 88 },
    { competency: 'Compensation & Benefits Strategy', level: 'Proficient', weight: 10, category: 'Financial Acumen', targetScore: 85 },
  ],
}

// SMART goal templates for the Goals module — user only edits target numbers.
export const GOAL_TEMPLATES = [
  { name: 'Increase Customer Satisfaction', description: 'Raise customer satisfaction score to the target level this period.', target: '90%', metric: 'Customer satisfaction score', unit: 'percentage' },
  { name: 'Improve Attendance', description: 'Improve attendance and punctuality to the target rate.', target: '95%', metric: 'Attendance rate', unit: 'percentage' },
  { name: 'Reduce Food Waste', description: 'Minimize food waste to the target percentage.', target: '5%', metric: 'Food waste', unit: 'percentage' },
  { name: 'Improve Sales', description: 'Grow sales contribution to the target amount.', target: 'PHP 100,000', metric: 'Sales', unit: 'amount' },
  { name: 'Improve Service Time', description: 'Reduce average service time to the target minutes.', target: '15', metric: 'Avg service time', unit: 'minutes' },
  { name: 'Increase Training Completion', description: 'Boost training completion rate to the target.', target: '90%', metric: 'Training completion', unit: 'percentage' },
]

// Quick comments — clickable chips that build a note without typing.
export const QUICK_COMMENTS = {
  performance: ['Excellent performance', 'Needs coaching', 'Requires training', 'Promotion candidate', 'Leadership potential', 'Attendance concern', 'Customer complaint'],
  competency: ['Strong core competencies', 'Skill gap identified', 'Developing toward target', 'Ready for advanced role', 'Needs focused coaching'],
  learning: ['Completed all activities', 'High engagement', 'Progressing on track', 'Needs extra support', 'Ready for next path'],
  training: ['Attended actively', 'Completed successfully', 'Strong understanding', 'Recommended follow-up', 'High effectiveness'],
  succession: ['Strong leadership potential', 'Ready for succession', 'Needs development', 'High potential', 'Backup needed'],
  recognition: ['Outstanding contribution', 'Excellent customer service', 'Great collaboration', 'Exceeds expectations', 'Deserves recognition'],
}

// AI-generation prompts used by the "Generate using AI" buttons on textareas.
export const AI_GENERATORS = {
  reviewTitle: 'Generate a professional review title for this period.',
  description: 'Generate a clear, professional description.',
  objectives: 'Generate measurable learning objectives.',
  prioritySkills: 'Generate a list of priority skills.',
  coachingNotes: 'Generate coaching notes based on the employees performance.',
  planTitle: 'Generate a development plan title.',
  rationale: 'Generate a nomination rationale.',
  reason: 'Generate a recognition reason.',
  approvalNotes: 'Generate professional approval notes.',
  publishMessage: 'Generate a professional employee notification message.',
  notes: 'Generate professional review notes.',
  reviewNotes: 'Generate professional record notes.',
  validationNotes: 'Generate professional validation notes.',
  hrNotes: 'Generate professional HR notes.',
  trainingObjectives: 'Generate measurable training objectives.',
  feedback: 'Generate constructive performance feedback.',
  reviewSummary: 'Generate a professional review summary.',
  learningRecommendation: 'Generate a learning recommendation.',
  developmentPlan: 'Generate a development plan.',
}

// ---------------------------------------------------------------------------
// PERFORMANCE — Review Cycle · KPI Builder · Scorecards · Calibration · Results
// ---------------------------------------------------------------------------
const performance = {
  module: 'performance',
  title: 'Performance Management',
  description: 'Run a full review cycle: configure KPIs, collect self and manager assessments, calibrate, and publish results.',
  dashboard: {
    heading: 'Review cycle overview',
    widgets: [
      { key: 'activeReviews', label: 'Active Reviews', type: 'count', source: 'workflowsActive' },
      { key: 'pendingReviews', label: 'Pending Reviews', type: 'count', source: 'workflowsPending' },
      { key: 'averageKpi', label: 'Average KPI', type: 'pct', source: 'avgPerformance' },
      { key: 'deptAverage', label: 'Department Average', type: 'pct', source: 'deptAvg' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
    ],
  },
  stepForms: {
create_review: {
      title: 'Create review cycle',
      description: 'Select the employee to evaluate and set the cycle details before they begin their self assessment.',
      fields: [
{ name: 'employee', label: 'Employee to evaluate', type: 'employee', required: true, hint: 'Select the subject of this review cycle' },
        { name: 'reviewTitle', label: 'Review title', type: 'text', required: true, defaultValue: 'Performance Review', hint: 'Auto-generated from period — edit if needed' },
        { name: 'reviewPeriod', label: 'Review period', type: 'select', required: true, options: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'] },
        { name: 'reviewType', label: 'Review type', type: 'select', required: true, options: REVIEW_TYPES },
        { name: 'department', label: 'Department', type: 'select', required: true, options: ['All', 'Front Office', 'Housekeeping', 'Food & Beverage', 'Kitchen', 'Engineering', 'Sales & Marketing', 'Human Resources', 'Finance', 'Security'], hint: 'Select the department for this review cycle' },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
      ],
    },
    self_assessment: {
      title: 'Employee self assessment',
      description: 'Complete the Hotel & Restaurant Employee Evaluation Form with 1–5 ratings, achievements, and development goals.',
      builder: 'assessment',
    },
    performance_evaluation: {
      title: 'Supervisor performance evaluation',
      description: 'Evaluate employee against hospitality standards, review self-ratings, and provide feedback.',
      builder: 'assessment',
    },
    calibration: {
      title: 'HR calibration & score alignment',
      description: 'Compare employee and supervisor scores, review rating variance, and set the final calibrated evaluation score.',
      builder: 'calibration',
    },
    final_approval: {
      title: 'Final approval',
      description: 'Approve the finalized evaluation so results can be published.',
      fields: [
        { name: 'approvalDecision', label: 'Decision', type: 'select', required: true, options: ['Approve', 'Approve with notes', 'Reject'] },
        { name: 'approvalNotes', label: 'Approval notes', type: 'textarea' },
      ],
    },
    published: {
      title: 'Publish results',
      description: 'Publish the review and notify the employee.',
      fields: [
        { name: 'publishToEmployee', label: 'Notify employee', type: 'toggle', required: true },
        { name: 'publishMessage', label: 'Employee message', type: 'textarea' },
      ],
    },
  },
  quickActions: [
    { label: 'Start review cycle', stage: 'create_review', roles: ['hr'] },
    { label: 'Complete self assessment', stage: 'self_assessment', roles: ['employee'] },
  ],
}

// ---------------------------------------------------------------------------
// COMPETENCY — Competency Library · Skill Gap Matrix · Assessment · Dev Plan
// ---------------------------------------------------------------------------
const competency = {
  module: 'competency',
  title: 'Competency Management',
  description: 'Define competency requirements, manage resources, assign development plans and assess the workforce.',
  dashboard: {
    heading: 'Competency overview',
    widgets: [
      { key: 'assessed', label: 'Employees Assessed', type: 'count', source: 'employees' },
      { key: 'avgCompetency', label: 'Average Competency', type: 'pct', source: 'avgCompetency' },
      { key: 'criticalGaps', label: 'Critical Skill Gaps', type: 'count', source: 'gapCount' },
      { key: 'devPlans', label: 'Development Plans', type: 'count', source: 'activeWorkflows' },
    ],
  },
  stepForms: {
define_requirements: {
      title: 'Define competency requirements',
      description: 'Pick a position template to auto-load required competencies, levels and weights.',
      builder: 'competencyTemplate',
    },
    assign_plan: {
      title: 'Assign development plan & course',
      description: 'Review detected skill gaps, pick recommended learning courses, and assign learning paths.',
      builder: 'skillGapPlan',
    },
    track_progress: {
      title: 'Track learning progress',
      description: 'Review the employee progress against the plan.',
      builder: 'progress',
    },
    update_record: {
      title: 'Update competency record',
      description: 'Compare actual empirical auto-lift score vs AI recommendation and finalize the updated competency score.',
      builder: 'competencyComparison',
    },
  },
  quickActions: [
    { label: 'Define requirements', stage: 'define_requirements', roles: ['hr'] },
    { label: 'Assign development plan', stage: 'assign_plan', roles: ['hr', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// LEARNING — Learning Catalog · Course Assignment · Progress Tracker
// ---------------------------------------------------------------------------
const learning = {
  module: 'learning',
  title: 'Learning Management',
  description: 'Publish courses, assign learning paths, track completion and measure learning effectiveness.',
  dashboard: {
    heading: 'Learning overview',
    widgets: [
      { key: 'activePaths', label: 'Active Learning Paths', type: 'count', source: 'activeWorkflows' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
      { key: 'overdue', label: 'Overdue Learning', type: 'count', source: 'overdue' },
      { key: 'assigned', label: 'Assigned Courses', type: 'count', source: 'enrollments' },
    ],
  },
  stepForms: {
    publish_resources: {
      title: 'Create learning path',
      description: 'Define the course, category, duration and learning objectives.',
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'category', label: 'Category', type: 'select', required: true, options: ['Leadership', 'Service', 'Safety', 'Operations', 'Compliance'] },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'duration', label: 'Duration (hours)', type: 'number', required: true },
        { name: 'objectives', label: 'Learning objectives', type: 'textarea', required: true },
      ],
    },
    enrollment: {
      title: 'Upload learning materials',
      description: 'Attach PDFs, videos, links and documents for this learning path.',
      builder: 'resources',
    },
    complete_activities: {
      title: 'Assign employees',
      description: 'Assign employees to the learning path.',
      builder: 'assignEmployees',
    },
    assessment: {
      title: 'Track completion',
      description: 'Review each learner progress, completion percentage and last activity.',
      builder: 'progress',
    },
    update_competency: {
      title: 'Generate AI learning insights',
      description: 'After assessment, generate the AI learning insight report.',
      aiOnly: true,
    },
  },
  quickActions: [
    { label: 'Create learning path', stage: 'publish_resources', roles: ['hr'] },
    { label: 'Assign learning', stage: 'complete_activities', roles: ['hr', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// TRAINING — Training Calendar · Session Details · Attendance · Evaluation
// ---------------------------------------------------------------------------
const training = {
  module: 'training',
  title: 'Training Management',
  description: 'Schedule trainings, manage participants, record attendance and evaluate effectiveness.',
  dashboard: {
    heading: 'Training overview',
    widgets: [
      { key: 'upcoming', label: 'Upcoming Trainings', type: 'count', source: 'upcoming' },
      { key: 'attendanceRate', label: 'Attendance Rate', type: 'pct', source: 'attendanceRate' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
      { key: 'activeSessions', label: 'Active Sessions', type: 'count', source: 'activeWorkflows' },
    ],
  },
  stepForms: {
    invite: {
      title: 'Invite participants',
      description: 'Select existing scheduled training session and invite employees.',
      builder: 'assignEmployees',
    },
    effectiveness: {
      title: 'Training evaluation',
      description: 'Collect participant feedback and assessment results.',
      builder: 'assessment',
    },
    published: {
      title: 'Generate AI training insights',
      description: 'After evaluation, generate the AI training insight report.',
      aiOnly: true,
    },
  },
  quickActions: [
    { label: 'Invite participants', stage: 'invite', roles: ['hr', 'supervisor'] },
    { label: 'Training evaluation', stage: 'effectiveness', roles: ['employee', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// SUCCESSION — Talent Pool · Readiness Matrix · Candidate Ranking · Pipeline
// ---------------------------------------------------------------------------
const succession = {
  module: 'succession',
  title: 'Succession Planning',
  description: 'Nominate candidates, assess readiness and build the succession pipeline for critical roles.',
  dashboard: {
    heading: 'Succession pipeline',
    widgets: [
      { key: 'readyNow', label: 'Ready Now', type: 'count', source: 'readyNow' },
      { key: 'readySoon', label: 'Ready Soon', type: 'count', source: 'readySoon' },
      { key: 'highPotential', label: 'High Potential', type: 'count', source: 'highPotential' },
      { key: 'criticalPositions', label: 'Critical Positions', type: 'count', source: 'criticalPositions' },
    ],
  },
  stepForms: {
    initiate: {
      title: 'Select Candidate & Initiate Assessment',
      description: 'Select an authorized employee to initiate their succession assessment cycle.',
      fields: [
        { name: 'employee', label: 'Candidate', type: 'employee', required: true },
        { name: 'notes', label: 'Cycle notes', type: 'textarea', placeholder: 'Key objectives or business context for this succession cycle...' },
      ],
    },
    nominate: {
      title: 'Candidate Nomination & AI Assessment',
      description: 'Review authorized employee profile, readiness scoring, and submit candidate nomination proposal.',
      builder: 'successionAssessment',
    },
    review_readiness: {
      title: 'Management Review & Succession Decision',
      description: 'Authorized HR/Manager review of capability matches, nomination rationale, and formal decision.',
      builder: 'successionReview',
    },
    approved: {
      title: 'Succession Approval & Position Update Execution',
      description: 'Authorize promotion, execute position update, and preserve position history.',
      builder: 'successionApproval',
    },
  },
  quickActions: [
    { label: 'Start succession assessment', stage: 'initiate', roles: ['hr', 'supervisor', 'operations_manager'] },
    { label: 'Review succession candidates', stage: 'review_readiness', roles: ['hr', 'supervisor', 'management', 'operations_manager'] },
  ],
}

// ---------------------------------------------------------------------------
// RECOGNITION — Recognition Feed · Nomination Form · Leaderboard · History
// ---------------------------------------------------------------------------
const recognition = {
  module: 'recognition',
  title: 'Social Recognition',
  description: 'Submit nominations, validate achievements, approve awards and issue badges automatically.',
  dashboard: {
    heading: 'Recognition overview',
    widgets: [
      { key: 'total', label: 'Total Recognitions', type: 'count', source: 'completed' },
      { key: 'topEmployee', label: 'Most Recognized', type: 'text', source: 'topEmployee' },
      { key: 'deptRecognition', label: 'Department Recognition', type: 'count', source: 'deptRecognition' },
      { key: 'monthly', label: 'Monthly Awards', type: 'count', source: 'monthly' },
    ],
  },
  stepForms: {
    submitted: {
      title: 'Submit nomination',
      description: 'Nominate a colleague with a category, reason and supporting evidence.',
      fields: [
        { name: 'employee', label: 'Employee', type: 'employee', required: true },
        { name: 'category', label: 'Recognition category', type: 'select', required: true, options: ['Customer Obsession', 'Leadership', 'Innovation', 'Service Excellence', 'Teamwork'] },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
        { name: 'evidence', label: 'Supporting evidence', type: 'fileHint', required: false, hint: 'Link or description of supporting evidence (optional)' },
      ],
    },
    supervisor_validation: {
      title: 'Department head review',
      description: 'Verify the achievement and nomination before HR approval.',
      fields: [
        { name: 'validated', label: 'Validation', type: 'select', required: true, options: ['Validated', 'Return for details'] },
        { name: 'validationNotes', label: 'Validation notes', type: 'textarea' },
      ],
    },
    hr_review: {
      title: 'HR approval',
      description: 'Approve to automatically issue the badge and certificate.',
      fields: [
        { name: 'decision', label: 'Decision', type: 'select', required: true, options: ['Approve & award', 'Reject'] },
        { name: 'badge', label: 'Badge', type: 'select', required: true, options: ['Gold', 'Silver', 'Bronze', 'Excellence Award'] },
        { name: 'hrNotes', label: 'HR notes', type: 'textarea' },
      ],
    },
  },
  quickActions: [
    { label: 'Submit nomination', stage: 'submitted', roles: ['employee', 'hr', 'supervisor'] },
    { label: 'Review nomination', stage: 'hr_review', roles: ['hr'] },
  ],
}

// ---------------------------------------------------------------------------
// Registry — look up config by module key used by WorkflowPage/ModuleAIInsights
// ---------------------------------------------------------------------------
export const MODULE_CONFIG = { performance, competency, learning, training, succession, recognition }

export function configFor(moduleKey) {
  return MODULE_CONFIG[moduleKey] || { module: moduleKey, title: '', description: '', dashboard: { widgets: [] }, stepForms: {}, quickActions: [] }
}

// ---------------------------------------------------------------------------
// Step guidance — per-stage "current task / required action / estimated time /
// checklist" copy shown in the workflow step guidance card. Falls back to the
// stage description when a stage is not listed here.
// ---------------------------------------------------------------------------
export const STAGE_GUIDES = {
  performance: {
    create_review: { task: 'Set up the review cycle', action: 'Enter cycle details and select scope', time: '~2 min', checklist: ['Add review title', 'Choose period', 'Set due date'] },
    self_assessment: { task: 'Complete your self assessment', action: 'Rate yourself against each KPI', time: '~5 min', checklist: ['Rate all questions', 'Add supporting comments'] },
    performance_evaluation: { task: 'Complete the evaluation', action: 'Review the self assessment and enter final ratings and evidence', time: '~5 min', checklist: ['Review each KPI', 'Fill final ratings', 'Add evidence'] },
    calibration: { task: 'Calibrate the scores', action: 'Compare and decide', time: '~3 min', checklist: ['Review score gap', 'Choose decision'] },
    final_approval: { task: 'Approve the results', action: 'Approve or reject the finalized review', time: '~1 min', checklist: ['Choose decision', 'Add notes (optional)'] },
    published: { task: 'Publish results', action: 'Notify the employee of the outcome', time: '~1 min', checklist: ['Confirm notification', 'Add message'] },
  },
  competency: {
    define_requirements: { task: 'Define competency requirements', action: 'Add position competency requirements', time: '~3 min', checklist: ['Add requirements', 'Set levels and weights'] },
    assign_plan: { task: 'Assign development plan', action: 'Review skill gaps and assign gap-specific learning courses', time: '~2 min', checklist: ['Review detected gaps', 'Assign recommended course', 'Set duration'] },
    track_progress: { task: 'Track learning progress', action: 'Review progress against the plan', time: '~2 min', checklist: ['Confirm progress', 'Note any blockers'] },
    update_record: { task: 'Update competency record', action: 'Finalize the new competency score', time: '~1 min', checklist: ['Enter new score', 'Add record notes'] },
  },
  learning: {
    publish_resources: { task: 'Create a learning path', action: 'Add course details and objectives', time: '~3 min', checklist: ['Add title', 'Choose category', 'Set objectives'] },
    enrollment: { task: 'Add learning materials', action: 'Attach resources for the path', time: '~2 min', checklist: ['Add resources', 'Provide links'] },
    complete_activities: { task: 'Assign employees', action: 'Select learners for the path', time: '~2 min', checklist: ['Select employees'] },
    assessment: { task: 'Track completion', action: 'Review learner progress', time: '~2 min', checklist: ['Confirm progress', 'Note completions'] },
    update_competency: { task: 'Generate AI learning insights', action: 'Review the AI report and complete', time: '~1 min', checklist: ['Review AI insights', 'Confirm completion'] },
  },
  training: {
schedule: { task: 'Create a training session', action: 'Set session details', time: '~3 min', checklist: ['Add title', 'Choose venue and date'] },
    invite: { task: 'Invite participants', action: 'Select participants', time: '~2 min', checklist: ['Select participants'] },
    attendance: { task: 'Record attendance', action: 'Mark who attended', time: '~2 min', checklist: ['Mark present / absent'] },
    effectiveness: { task: 'Measure effectiveness', action: 'Collect feedback and results', time: '~3 min', checklist: ['Rate effectiveness', 'Add comments'] },
    published: { task: 'Generate AI training insights', action: 'Review the AI report and complete', time: '~1 min', checklist: ['Review AI insights', 'Confirm completion'] },
  },
  succession: {
    initiate: { task: 'Create a succession cycle', action: 'Set scope and critical roles', time: '~2 min', checklist: ['Add cycle title', 'Choose scope', 'List critical roles'] },
    review_readiness: { task: 'Review candidate readiness', action: 'Select the critical position', time: '~2 min', checklist: ['Review talent pool', 'Select candidates'] },
    nominate: { task: 'Nominate candidates', action: 'Add candidates and rationale', time: '~3 min', checklist: ['Add candidates', 'Provide rationale'] },
    approved: { task: 'Generate AI readiness analysis', action: 'Review the AI report and approve', time: '~1 min', checklist: ['Review AI insights', 'Choose decision'] },
  },
  recognition: {
    submitted: { task: 'Submit a nomination', action: 'Nominate a colleague', time: '~2 min', checklist: ['Select employee', 'Choose category', 'Add reason'] },
    supervisor_validation: { task: 'Validate the nomination', action: 'Verify the achievement', time: '~2 min', checklist: ['Review evidence', 'Choose validation'] },
    hr_review: { task: 'Approve the award', action: 'Approve and issue the badge', time: '~1 min', checklist: ['Choose decision', 'Assign badge'] },
  },
}

// ---------------------------------------------------------------------------
// Comment suggestion chips — quick selectable phrases that build a comment with
// a single click instead of typing. Keyed by module.
// ---------------------------------------------------------------------------
export const COMMENT_SUGGESTIONS = {
  performance: ['Consistently meets targets', 'Excellent communication', 'Strong teamwork', 'Needs improvement in attendance', 'Shows initiative and ownership', 'Areas for growth noted in KPIs'],
  competency: ['Demonstrates strong core competencies', 'Skill gap identified in required area', 'Developing toward target level', 'Ready for advanced responsibility', 'Needs focused coaching'],
  learning: ['Completed all assigned activities', 'High engagement with materials', 'Progressing on track', 'Needs additional support', 'Ready for next learning path'],
  training: ['Attended and participated actively', 'Completed the training successfully', 'Good understanding of content', 'Recommended follow-up session', 'High training effectiveness'],
  succession: ['Strong leadership potential', 'Ready for near-term succession', 'Requires development before readiness', 'High-potential candidate', 'Risk of vacancy without backup'],
  recognition: ['Excellent contribution this period', 'Outstanding customer service', 'Great team collaboration', 'Consistently exceeds expectations', 'Deserves formal recognition'],
}

// ---------------------------------------------------------------------------
// Quick decision presets — one-click approve / reject actions per module with
// the auto-generated note that will be recorded.
// ---------------------------------------------------------------------------
export const QUICK_DECISIONS = {
  performance: { approve: 'Approved by reviewer', reject: 'Returned for revision by reviewer' },
  competency: { approve: 'Approved by reviewer', reject: 'Returned for revision' },
  learning: { approve: 'Approved', reject: 'Returned for revision' },
  training: { approve: 'Approved', reject: 'Returned for revision' },
  succession: { approve: 'Approved', reject: 'Returned for revision' },
  recognition: { approve: 'Approved', reject: 'Rejected' },
}

// Detect whether a workflow stage is an "approval" step. Approval steps should
// present an "Approve & Continue" primary action (plus "Return for Revision")
// instead of the generic "Complete Step", and should not show both together.
const APPROVAL_HINTS = ['approve', 'validat', 'review', 'final_approval', 'hr_review', 'supervisor_validation', 'approved', 'publish']
export function isApprovalStage(stageKey = '', formConfig) {
  const key = String(stageKey || '').toLowerCase()
  if (key && APPROVAL_HINTS.some(hint => key.includes(hint))) return true
  // Heuristic: a form with a required select whose options include "Approve"
  // is treated as an approval decision.
  const fields = formConfig?.fields || []
  return fields.some(field =>
    field.type === 'select' &&
    Array.isArray(field.options) &&
    field.options.some(opt => /approve/i.test(opt)),
  )
}

// Build a module-specific stats object from live API data.
// data = analytics dashboard payload; workflows = workflow list for the module
export function computeModuleStats(moduleKey, data = {}, workflows = []) {
  // `data` can be null when a non-HR role cannot access the analytics endpoint.
  data = data || {}
  const totals = data.totals || {}
  const employees = data.employees || []
  const breakdown = data.workflowBreakdown || []
  const active = workflows.filter(w => w.status === 'active').length
  const completed = workflows.filter(w => w.status === 'completed').length
  const total = active + completed
  const completionRate = total ? Math.round((completed / total) * 100) : 0
  const avgPerformance = Number(totals.average_performance || 0)
  const avgCompetency = Number(totals.average_competency || 0)
  const avgLearning = Number(totals.learning_completion || 0)
  const deptAvgs = employees.reduce((map, e) => {
    map[e.department] = map[e.department] || []
    map[e.department].push(Number(e.performance_score || 0))
    return map
  }, {})
  const deptAvg = Object.keys(deptAvgs).length
    ? Math.round(Object.values(deptAvgs).flat().reduce((s, v) => s + v, 0) / Math.max(1, Object.values(deptAvgs).flat().length))
    : 0
  const countsByStatus = breakdown.filter(b => b.module === moduleKey).reduce((m, r) => { m[r.status] = r.count; return m }, {})
  const completedCount = Number(countsByStatus.completed || 0)
  const activeCount = Number(countsByStatus.active || 0)
  const totalModule = completedCount + activeCount
  const moduleCompletion = totalModule ? Math.round((completedCount / totalModule) * 100) : completionRate

  const getReadiness = (e) => {
    if (e.readiness && e.readiness !== 'development_needed') return e.readiness
    const perf = Number(e.performance_score || 0)
    const comp = Number(e.competency_score || 0)
    const learn = Number(e.learning_progress || 0)
    const score = Math.round(perf * 0.5 + comp * 0.3 + learn * 0.2)
    return score >= 85 ? 'ready_now' : score >= 70 ? 'ready_in_1_2_years' : 'development_needed'
  }

  const pool = {
    workflowsActive: active,
    workflowsPending: active, // pending elsewhere
    activeWorkflows: active,
    avgPerformance,
    avgCompetency,
    avgLearning,
    deptAvg,
    completionRate: moduleCompletion,
    employees: employees.length,
    gapCount: employees.filter(e => Number(e.competency_score || 0) < 70).length,
    activePaths: active,
    assignedCourses: active,
    overdue: 0,
    upcoming: active,
    attendanceRate: moduleCompletion,
    readyNow: totals.succession_ready ?? employees.filter(e => getReadiness(e) === 'ready_now').length,
    readySoon: employees.filter(e => getReadiness(e) === 'ready_in_1_2_years').length,
    highPotential: employees.filter(e => Number(e.performance_score || 0) >= 80 && Number(e.competency_score || 0) >= 80).length,
    criticalPositions: 0,
    completed: completedCount,
    topEmployee: '',
    deptRecognition: completedCount,
    monthly: completedCount,
    totalRecords: employees.length,
    lastUpdated: new Date().toISOString(),
  }
  return pool
}

