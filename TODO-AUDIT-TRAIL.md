TODO: Unified Audit & Trail (Activity Logs) Across All RBAC Roles

## Backend
- [x] 1. Create migration `021_activity_logs.sql` (general-purpose activity_logs table)
- [x] 2. Create service `src/services/activity.js` (logActivity best-effort helper)
- [x] 3. Rewrite `routes/audit.js` to query activity_logs with filters + broadened access
- [x] 4. Instrument `routes/auth.js` (login, logout, refresh, invite, register, pw reset)
- [x] 5. Instrument `routes/employees.js` (create, update, deactivate, reactivate, invite)
- [x] 6. Instrument `routes/certificates.js` (template CRUD, issue, revoke, regenerate, check-expiry)
- [x] 7. Instrument `routes/learningResources.js` (CRUD, assign, completion)
- [x] 8. Instrument `routes/workflows.js` (create, advance, complete, return, cancel, note, due-date, report-generate)

## Frontend
- [x] 9. Create page `src/pages/AuditLogs.jsx` (filters, pagination, CSV export)
- [x] 10. Update `lib/api.js` (extend auditLogs filters, return unified logs)
- [x] 11. Update `components/Sidebar.jsx` (add Audit Trail nav for hr/ops/management)
- [x] 12. Update `App.jsx` (register /audit route)
- [x] 13. Add CSS for audit trail page

## Verification
- [x] 14. Create activity_logs table (applied directly — see note below)
- [x] 15. Verify logActivity inserts (valid + null role) and readback
- [x] 16. Frontend production build passes (audit viewer + routing + sidebar compile)

## Quality & Observability (added this session)
- [x] 17. Add structured logger `src/services/logger.js` (JSON request/error logging)
- [x] 18. Add `requestLogger` middleware + wire into `server.js` (method/path/status/duration/actor)
- [x] 19. Upgrade `errorHandler`/`notFound` to log via logger (no stack leak in production)
- [x] 20. Add unit tests `test/metrics.test.js` (weighting + band boundaries) — 6 tests
- [x] 21. Add GitHub Actions CI workflow `.github/workflows/ci.yml` (backend test + frontend lint/build)
- [x] 22. Full backend test suite passes: 17 tests (11 original + 6 new metrics)

> **Migration note:** `020_competency_assessments.sql` previously had a SQL syntax
> error (`syntax error at or near "DO"`) caused by `ON CONFLICT ... DO NOTHING`
> combined with an `INSERT ... SELECT` from a `VALUES` subquery. This was fixed by
> replacing it with an equivalent `WHERE NOT EXISTS` guard, which is compatible with
> all PostgreSQL versions. `npm run migrate` now runs the full chain cleanly
> (020 and 021 both apply).
