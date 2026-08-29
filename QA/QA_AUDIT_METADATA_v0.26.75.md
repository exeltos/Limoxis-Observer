# v0.26.75 — Audit metadata normalization, batch 2

## Scope
Continues the common audit/traceability model introduced in v0.26.74.

## Changes
- Prevention Waste edits now retain `updatedById`.
- Antiseptic Consumption edits now retain `updatedById`.
- Bundle execution edits now retain `updatedById`.
- Generic Prevention records initialize created/updated timestamp, actor name and actor ID consistently.
- WHO Hand Hygiene records initialize updated metadata alongside creation metadata.
- Employee creation initializes both creation and update metadata.
- Committee meeting/decision/annual-plan status updates now include `updatedById` wherever `updatedBy` was already persisted.

## Governance rule
Operational records now move toward one contract:
`createdAt`, `createdBy`, `createdById`, `updatedAt`, `updatedBy`, `updatedById`.

Historical evidence is not rewritten. Existing stable IDs and domain persistence values are preserved.

## Verification
Passed:
- Clinical i18n
- Product permissions: 22 assertions
- Navigation: 18/18
- React hooks: 136 files
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
