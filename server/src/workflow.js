// A single source of truth for allowed stages. The API never accepts a client-supplied stage.
export const WORKFLOWS = {
  performance: [
    ['create_review', 'Create review', ['hr']],
    ['self_assessment', 'Self assessment', ['employee']],
    ['performance_evaluation', 'Performance evaluation', ['supervisor']],
    ['calibration', 'Calibration', ['hr']],
    ['final_approval', 'Final approval', ['hr']],
    ['published', 'Publish results', ['hr']],
  ],
  competency: [
    ['define_requirements', 'Define competency requirements', ['hr']],
    ['assign_plan', 'Assign development plan', ['hr', 'supervisor']],
    ['track_progress', 'Track learning progress', ['employee', 'supervisor']],
    ['update_record', 'Update competency record', ['hr']],
  ],
  learning: [
    ['publish_resources', 'Publish learning resources', ['hr']],
    ['enrollment', 'Employee enrollment', ['hr', 'supervisor']],
    ['complete_activities', 'Complete learning activities', ['employee']],
    ['assessment', 'Post-learning assessment', ['employee', 'supervisor']],
    ['update_competency', 'Update competency records', ['hr']],
  ],
  training: [
    ['invite', 'Invite participants', ['hr', 'supervisor']],
    ['effectiveness', 'Measure effectiveness', ['employee', 'supervisor']],
    ['published', 'Publish analytics', ['hr']],
  ],
  succession: [
    ['initiate', 'Initiate succession assessment', ['hr', 'supervisor', 'operations_manager']],
    ['nominate', 'Candidate nomination & AI assessment', ['hr', 'supervisor', 'operations_manager']],
    ['review_readiness', 'Review readiness & AI recommendations', ['hr', 'supervisor', 'management', 'operations_manager']],
    ['approved', 'Management & HR approval', ['hr', 'management', 'supervisor', 'operations_manager']],
  ],
  recognition: [
    ['submitted', 'Submit nomination', ['employee', 'hr', 'supervisor']],
    ['supervisor_validation', 'Supervisor validation', ['supervisor']],
    ['hr_review', 'HR review', ['hr']],
  ],
}

export function stagesFor(module) {
  const stages = WORKFLOWS[module]
  if (!stages) throw Object.assign(new Error('Unsupported workflow module'), { status: 400 })
  return stages
}

// Determine whether an actor may act on a stage. The actor may act if their
// role is in the stage's assigned roles, OR if the stage is employee-assigned
// and the actor IS the workflow's subject (so e.g. a department-head subject
// can still complete their own self-assessment regardless of role label).
export function canActOnStage(stageRoles, role, subjectEmployeeId, actorEmployeeId) {
  if (role === 'employee' && subjectEmployeeId) {
    return stageRoles.includes('employee') && Boolean(actorEmployeeId && actorEmployeeId === subjectEmployeeId)
  }
  if (stageRoles.includes(role)) return true
  if (stageRoles.includes('employee') && actorEmployeeId && subjectEmployeeId && actorEmployeeId === subjectEmployeeId) {
    return true
  }
  return false
}

function assertStageOwner(currentLabel, currentRoles, role, subjectEmployeeId, actorEmployeeId) {
  if (!canActOnStage(currentRoles, role, subjectEmployeeId, actorEmployeeId)) {
    throw Object.assign(new Error(`${currentLabel} must be completed by ${currentRoles.join(' or ')}.`), { status: 403 })
  }
}

export function nextStage(module, currentStage, role, subjectEmployeeId, actorEmployeeId) {
  const stages = stagesFor(module)
  const currentIndex = stages.findIndex(([key]) => key === currentStage)
  if (currentIndex < 0) throw Object.assign(new Error('Workflow has an invalid current stage.'), { status: 409 })
  const [, currentLabel, currentRoles] = stages[currentIndex]
  assertStageOwner(currentLabel, currentRoles, role, subjectEmployeeId, actorEmployeeId)
  if (currentIndex === stages.length - 1) return null
  const [key, label, roles] = stages[currentIndex + 1]
  return { key, label, roles }
}

// Earlier stages that a current stage owner may return a workflow to.
export function previousStages(module, currentStage, role, subjectEmployeeId, actorEmployeeId) {
  const stages = stagesFor(module)
  const currentIndex = stages.findIndex(([key]) => key === currentStage)
  if (currentIndex < 0) throw Object.assign(new Error('Workflow has an invalid current stage.'), { status: 409 })
  const [, currentLabel, currentRoles] = stages[currentIndex]
  assertStageOwner(currentLabel, currentRoles, role, subjectEmployeeId, actorEmployeeId)
  return stages.slice(0, currentIndex).map(([key, label, roles]) => ({ key, label, roles }))
}

// Return a workflow to an earlier stage. Without a target, returns one stage back.
export function returnToStage(module, currentStage, role, targetStage, subjectEmployeeId, actorEmployeeId) {
  const stages = stagesFor(module)
  const currentIndex = stages.findIndex(([key]) => key === currentStage)
  if (currentIndex < 0) throw Object.assign(new Error('Workflow has an invalid current stage.'), { status: 409 })
  const [, currentLabel, currentRoles] = stages[currentIndex]
  assertStageOwner(currentLabel, currentRoles, role, subjectEmployeeId, actorEmployeeId)
  if (currentIndex === 0) throw Object.assign(new Error('This workflow is at its first stage and cannot be returned further.'), { status: 409 })
  let targetIndex
  if (targetStage) {
    targetIndex = stages.findIndex(([key]) => key === targetStage)
    if (targetIndex < 0) throw Object.assign(new Error('Target stage does not exist in this workflow.'), { status: 400 })
    if (targetIndex >= currentIndex) throw Object.assign(new Error('You can only return to an earlier stage.'), { status: 400 })
  } else {
    targetIndex = currentIndex - 1
  }
  const [key, label, roles] = stages[targetIndex]
  return { key, label, roles }
}
