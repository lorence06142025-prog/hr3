import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function SuccessionPlanning() {
  return (
    <WorkflowPage
      module="succession"
      title="Succession planning"
      description="Assess candidate readiness, generate AI-assisted critical role recommendations, and complete authorized management review."
      action={{
        hr: 'Start succession assessment',
        supervisor: 'Start succession assessment',
        operations_manager: 'Start succession assessment',
        management: 'Review succession candidates',
      }}
      stages={[
        ['Initiate assessment', 'Select candidate and initiate succession assessment cycle.', ['hr', 'supervisor', 'operations_manager']],
        ['Candidate assessment', 'Review employee capability data and AI critical role recommendation.', ['hr', 'supervisor', 'operations_manager']],
        ['Review readiness', 'Review readiness scores, competency matches, and skill gaps.', ['hr', 'supervisor', 'management', 'operations_manager']],
        ['Approval & position update', 'Authorize succession promotion, update employee position, and preserve history.', ['hr', 'management', 'supervisor', 'operations_manager']],
      ]}
      items={[]}
      itemLabel="Succession candidate"
      itemIsEmployee
    />
  )
}
