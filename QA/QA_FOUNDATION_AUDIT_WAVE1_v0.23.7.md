# Limoxis Observer — Foundation Audit Wave 1 — v0.23.7

Date: 2026-08-28

## Scope
Platform foundation before further module expansion:
- route/capability gates
- Management Center role access
- registry → detail → exact return behavior
- record sequence navigation
- browser-default interaction audit
- shared feedback/delete behavior
- baseline smoke checks

## Findings fixed

### 1. Management Center route was too restrictive
The sidebar exposed management areas according to granular capabilities, but `/management`
was guarded only by `MANAGE_ORGANIZATION`. This could show a valid Management link to a role
such as Infection Control Lead or Quality Manager and then redirect them away from the route.

Fix:
- introduced `MANAGEMENT_CAPABILITIES`
- introduced `RequireAnyCapability`
- `/management` now accepts any legitimate management capability
- Management tabs themselves are hidden unless the role has the matching capability

This makes the route gate and the visible UI policy consistent and prepares the same policy
for future Supabase/RLS mapping.

### 2. Registry sequence navigation was only complete in Prevention
Patients, Employees, Laboratory, Surveillance, Quality and Controls now store the ordered IDs
of the currently filtered registry when a row is opened.
Their detail pages now use `useRecordSequenceNavigation`, so Previous/Next follows the exact
filtered registry sequence rather than an unrelated global order.

### 3. Exact return/view restoration gaps
Controls did not save/load its filters before opening a record.
Prevention saved per-tab filters but did not reload them when returning/switching tabs.

Fix:
- Controls now persists/restores query, department, status and frequency.
- Prevention restores query, department, period, product and method per tab.
- row highlight + scroll restoration continue to use the shared registry-memory mechanism.

### 4. Browser-native prompt remained in Libraries
`LibrariesPanel` still used `window.prompt()` for add/edit.

Fix:
- replaced with a compact in-app editor dialog
- uses shared buttons/feedback
- no native prompt remains in source

### 5. Quality row navigation duplicated state writes
A duplicate `sessionStorage` / `saveViewState` sequence existed in the Quality row click handler.
It was removed.

### 6. Delete feedback semantics
Quality delete confirmation already existed, but successful deletion emitted warning feedback.
It now emits success feedback, preserving the environment-aware feedback color policy.

## Validation
- Navigation smoke: PASS — 18/18
- React hook smoke: PASS — 105 source files
- Product permissions: PASS — 15 assertions
- Native `prompt(` scan: 0 hits
- Full Vite build: not run because dependencies/node_modules are not included in the supplied archive.

## Next audit wave
Recommended next: data governance + clinical record lifecycle:
- immutable history / correction-reopen consistency
- actor/timestamps and provenance
- source-of-truth libraries
- denominator provenance
- finalized-record mutation paths
- privacy/sensitive employee-health access
- Supabase/RLS policy mapping readiness
