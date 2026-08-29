# v0.27.8 — CI / Runtime / Navigation Hotfix

## GitHub Actions errors fixed
`LaboratorySampleRecordPage.jsx`
- `actor` existed only in the top-level page component.
- Nested result/finalization components referenced `actor.id` and lifecycle helpers without receiving `actor`.
- `actor` is now explicitly passed into ResultPanel, EmployeeScreeningLaboratoryRecord, EnvironmentalLaboratoryRecord, EnvironmentalFinalization and FinalizationPanel.

`EmployeeRecordPage.jsx`
- `InlineDateDetail` rendered an undefined `<Field />`.
- Replaced with the canonical `detail-item` markup already used by the record screen.

## Runtime navigation
- Employee detail route remains directly renderable at `/employees/:employeeId`.
- Surveillance detail route `/surveillance/:caseId` now also renders the record page directly instead of applying a second route-level capability redirect.
- Both record pages retain their own scope/record authorization checks.
- This avoids the list opening successfully and the detail route immediately bouncing before record-level checks can run.

## Laboratory cards
The Laboratory registry retains the shared `MetricCard` implementation introduced in v0.27.7.

## CI
`.github/workflows/ci.yml` remains included and runs `npm run check` on push/pull request to main.

## Static verification
- v0.27.8 regression: 11/11 + actor/Field scan
- navigation: 18/18
- React hooks: 141 files
- Observer UI: OK
- card/dialog geometry: 15/15
- data-access foundation: 16/16 + storage/error scan
- permissions: 22 assertions
- governance foundation: 8/8
- EL/EN parity: 1346/1346

A local `npm ci` attempt timed out in the sandbox, so the dependency-backed ESLint/test/build gate must be confirmed by the GitHub Action after commit/push.
