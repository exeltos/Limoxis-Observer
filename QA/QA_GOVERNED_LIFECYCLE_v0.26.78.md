# v0.26.78 — Governed lifecycle foundation

## Purpose
Introduce one reusable lifecycle contract before migrating every finalized operational record.

## Shared lifecycle contract
New `src/core/audit/governedLifecycle.js` provides:
- `finalizeRecord`
- `openCorrection`
- `voidRecord`
- `lifecycleEvent`
- stable lifecycle statuses

Every governed transition records:
- timestamp
- actor display name
- stable actor ID
- mandatory reason where applicable
- updated metadata
- append-only history event

## UI
`GovernedReasonDialog` remains the common low-friction reason dialog and now has bilingual governed-change framing.
Quality correction/void confirmation labels are fully EL/EN.

## Regression guard
Added `tools/check-governed-lifecycle.mjs` to verify that the common lifecycle primitives and actor-ID fields remain present.

## Important
This version establishes the common contract; it deliberately does not bulk-rewrite every existing workflow in one pass. Existing Prevention, Quality and Laboratory governed behavior remains functional. Subsequent batches can migrate those flows to the shared helper safely and consistently.

## Verification
- Governed lifecycle: 7/7
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137 files
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
