# v0.27.7 — Laboratory Cards / Employee Navigation / CI Hotfix

## Laboratory cards
The Laboratory page was still rendering its own legacy `lab-kpi` markup even though `MetricCard` was imported.
`LabKpi` now returns the shared `MetricCard` directly, so Laboratory uses the exact same typography, icon sizing, height and spacing contract as the other modules.

## Employees
The employee list still uses the shared registry-memory navigation, but the detail route no longer has the redundant route-level `VIEW_STAFF` redirect.
`EmployeeRecordPage` performs its own record/scope check. This prevents a route bounce before the employee record renders while preserving frontend scope enforcement.

`My Profile` likewise renders `EmployeeRecordPage selfMode` directly; self linking is enforced inside the page.

## GitHub Actions
The previous release archive did not contain `.github/workflows/ci.yml` at all.
This release restores it with:
- push to main
- pull request to main
- workflow_dispatch
- Node 22.22.2
- npm ci
- npm run check

Creating/downloading a ZIP does not itself start GitHub Actions. A commit/push to `main` is required. Once the files from this release are committed to `main`, the included workflow is eligible to run.

## Checks
- v0.27.7 regression: 7/7 + legacy lab scan
- navigation: 18/18
- React hooks: 141 files
- Observer UI: OK
- card/dialog geometry: 15/15
- English parity: 1346/1346

Full dependency-backed lint/test/build was not run locally because dependencies are not available in the release workspace. The restored GitHub workflow is the final gate.
