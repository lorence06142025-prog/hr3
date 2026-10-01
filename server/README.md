# PDS backend

This API provides authentication, PostgreSQL storage, role-based permissions, analytics, and protected workflows for performance, competency, learning, training, succession, and recognition.

## Workflow rules

Each workflow has one ordered, server-controlled set of stages. The client cannot choose a later stage or mark work complete out of order. The role assigned to the current stage must advance it; the following stage is then assigned to its intended role. Every action is recorded in `workflow_events`, giving HR a complete audit history.

Roles are `employee`, `supervisor`, `management`, `operations_manager`, and `hr`. Employees can only view or update workflows linked to their own employee record. Supervisor, manager, operations manager, and HR access is separately enforced at each action.

## AI-assisted workflow analytics

AI is integrated as part of every workflow, not as a separate feature. When a workflow reaches its final stage, the system:

1. Completes the module workflow steps.
2. Automatically calculates module metrics from the live database.
3. Generates AI insights using those metrics.
4. Saves the AI report to the `ai_reports` table.
5. Records the save as an `ai_report` event in the workflow audit trail (`workflow_events`).

The saved report stays viewable after the workflow is completed via `GET /api/workflows/:id/ai-reports`. Reports use only data from the current module, never invent values, and state "insufficient records" when data is unavailable. The executive dashboard (`GET /api/analytics/executive-report`) combines all modules and is structured into 11 professional sections.

## Set up PostgreSQL

Create a local database named `perdevsys`, then copy `.env.example` to `.env` and set a unique `JWT_SECRET`. The migrations automatically create the demo accounts listed below.

```powershell
cd pds/server
npm install
npm run migrate
npm run dev
```

The frontend is started separately from `pds` with `npm run dev`; its development proxy routes `/api` to port 4000.

## AI insights with OpenRouter

Add `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` to `pds/server/.env`, then restart the API. The key is used only by the backend; it is never sent to the browser. `POST /api/analytics/insights` sends aggregate, non-identifying workforce metrics to OpenRouter and returns concise insight cards.

When no API key is configured (or the LLM call fails), the server gracefully falls back to deterministic, template-based reports built from the same database metrics, so the dashboard keeps working in demos and offline environments.

Demo accounts all use `ChangeMe123!`:

| Role | Email |
| --- | --- |
| HR | ava@pds.local |
| Supervisor | jordan@pds.local |
| Employee | emily@pds.local |

## Key endpoints

- `POST /api/auth/login`
- `GET /api/workflows/definitions`
- `GET, POST /api/workflows`
- `GET /api/workflows/:id`
- `POST /api/workflows/:id/advance`
- `POST /api/workflows/:id/return` — send a workflow back to an earlier stage (current stage owner)
- `POST /api/workflows/:id/cancel` — cancel a workflow (workflow owner or HR)
- `GET /api/analytics/dashboard`
- `GET /api/analytics/me`
- `POST /api/analytics/module-insights` — generate a structured AI report for a module
- `GET /api/analytics/executive-report` — load the latest saved executive report
- `POST /api/analytics/executive-report` — generate + save a new executive report (HR only)
- `GET /api/workflows/:id/ai-reports` — fetch saved AI reports linked to a workflow (audit trail)

The request body for advancing is `{ "note": "optional audit note", "data": {} }`. The server decides the next stage; do not include a stage name in the body.

The request body for returning is `{ "targetStage": "earlier_stage", "note": "optional reason", "data": {} }`. If `targetStage` is omitted, the workflow moves back exactly one stage. The body for cancelling is `{ "reason": "why this is cancelled", "data": {} }`.
