# TODO: Quality & Production-Hardening Improvements

Address the gaps/weaknesses identified in the system evaluation.

## 1. Structured Logging & Observability
- [ ] Create `server/src/services/logger.js` — lightweight JSON logger (timestamp, level, message, meta)
- [ ] Add request-logging middleware in `server.js` (method, path, status, duration, user)
- [ ] Update `errorHandler` to log full error details with stack in development
- [ ] Replace scattered `console.warn`/`console.error` with the logger where impactful

## 2. Error Resilience & Silent Swallows
- [ ] Audit route `catch {}` blocks that silently swallow errors
- [ ] Ensure `errorHandler` gives useful client feedback + server-side detail
- [ ] Add a centralized async wrapper or ensure consistent `next(error)` usage

## 3. Validation Consistency
- [ ] Confirm all mutating routes use Zod schemas
- [ ] Add missing validation on key routes (workflows, certificates, learning)

## 4. Pagination on Large Endpoints
- [ ] Add page/limit pagination to employees list, certificates list, learning resources

## 5. Accessibility Improvements
- [ ] Add `aria-label` to icon-only buttons in Header
- [ ] Ensure form inputs have associated labels
- [ ] Add focus-visible styles where missing
- [ ] Add `role="dialog"`/`aria-modal` where appropriate

## 6. Automated Testing
- [ ] Add unit tests for `activity.js` service
- [ ] Add unit tests for `audit.js` route authorization
- [ ] Add tests for `metrics.js` edge cases
- [ ] Ensure `npm test` runs clean

## 7. CI/CD Pipeline
- [ ] Add `.github/workflows/ci.yml` — lint, build, test on push/PR

## 8. Migration 020
- [ ] Verify migration 020 applies cleanly; fix any syntax issue

## 9. Documentation
- [ ] Update README with quality/ops notes
