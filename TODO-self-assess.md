# Fix: Employee self-assessment cannot be submitted

## Goal
Allow the workflow **subject** to complete employee-assigned stages (e.g. `self_assessment`) regardless of their role label, across frontend and backend.

## Steps
- [x] 1. `pds/server/src/workflow.js` — subject-aware stage authorization in `nextStage`, `previousStages`, `returnToStage`
- [x] 2. `pds/server/src/routes/workflows.js` — pass `subjectEmployeeId` into advance; relax notes role gate for subject
- [x] 3. `pds/server/src/routes/auth.js` — include `employeeId` in login/register user payload
- [x] 4. `pds/src/components/WorkflowPage.jsx` — subject-aware `canAct` so Complete button shows for the subject
- [x] 5. Remove temporary `inspect_self_assess.js`
