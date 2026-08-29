# v0.27.2 — Data Access / Supabase Foundation

## Baseline
Built from v0.27.0. The rejected visual v0.27.1 branch is not used.

## 1. Missing Supabase persistence
Added migration:
`supabase/migrations/202608290014_v0271_data_access_foundation.sql`

New tables:
- `training_records`
- `environmental_standards`
- `control_drafts`

All three:
- organization scoped
- RLS enabled
- indexed
- server-side audit/actor metadata where applicable

Training is represented as typed rows in cloud mode (`program`, `assignment`, `certificate`, `email_outbox`, `history`) so RLS can enforce department / employee scope instead of exposing one organization-wide JSON blob.

## 2. One data-access layer
Added:
- `src/core/data/repository.js`
- `load(table)`
- `save(table, rows)`
- `loadSnapshot(table)`
- `saveSnapshot(table, rows)`
- centralized storage-key registry

Direct `localStorage` access was removed from feature/core modules. The only remaining direct localStorage implementation is inside the repository adapter.

Existing local datasets routed through the repository include training, environmental standards, control drafts, documents, employees, indicators, committees/approvals, management libraries/settings, bundle library, announcements and notification-read state.

Cloud-unmapped legacy datasets are explicitly marked `cloud:false`; switching cloud mode therefore fails visibly instead of silently querying a wrong/nonexistent schema. Their future remote mapping is now changed centrally in the repository rather than in feature files.

## 3. Loading / saving / error state
Added:
- `src/core/data/useRepositoryData.js`
- `src/core/data/DataAccessStatus.jsx`

Repository operations emit explicit states:
- loading
- saving
- success
- error

Errors are no longer swallowed. Failed writes emit a visible global error with retry. Environmental Standards is the first screen migrated to the full async hook with inline loading/error/retry and save disabling.

Synchronous feature flows use the repository snapshot façade for local/demo compatibility. In cloud mode the snapshot façade becomes optimistic and delegates the network write to the same repository, so failures still surface globally.

## 4. RLS mirrors frontend authorization
Added DB-side `current_user_has_capability(...)` bridge for the capabilities used by these new data domains, including:
- base role capabilities
- custom-role capabilities
- relevant add-on capability grants
- platform owner override

Policies include:
- training: hospital-wide privileged roles, department-scoped manager/user access, employee-self records, `manage_training`
- environmental standards: IPC/Laboratory read, `manage_libraries` write
- control drafts: creator-private by default, department scope, `manage_controls` manager override

This prevents the frontend from being the only security boundary.

## 5. Guardrail
Added:
`tools/check-data-access-foundation.mjs`

It verifies:
- all three migrations/tables exist
- RLS/capability policies exist
- common repository methods exist
- loading/saving/error states exist
- no direct `localStorage` remains outside `core/data/repository.js`
- no empty silent catch blocks remain in scanned source

## Verification
- Data access foundation: 16/16 + global storage/error scan
- Governance foundation: 8/8
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Permissions: 22
- Navigation: 18/18
- React hook smoke: 140 files
- Observer UI: OK
- Date/time controls: 0 native feature controls
- English parity: 1346/1346

`node --check` also passed for the touched plain-JS storage/data modules.

Full dependency-backed `npm run check` was not run because the release archive does not contain installed dependencies. CI remains the final lint/test/build gate.
