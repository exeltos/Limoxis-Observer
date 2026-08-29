# v0.26.76 — Audit metadata normalization, batch 3

## Scope
Completes the next operational-record pass for surveillance workflows.

## Changes
- Environmental surveillance records now persist actor ID as well as actor name.
- Environmental surveillance batches initialize standard created/updated metadata.
- Employee surveillance records initialize standard created/updated metadata with actor ID.
- Employee surveillance batches carry actor IDs and update metadata.
- Employee recheck scheduling updates `updatedAt`, `updatedBy`, `updatedById`.
- Recheck timeline events now carry `actorId`.
- Flow call sites pass the signed-in audit actor ID instead of only a display name.

## Target metadata contract
`createdAt`, `createdBy`, `createdById`, `updatedAt`, `updatedBy`, `updatedById`.

Historical evidence and stable record IDs remain untouched.

## Verification
Passed:
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 136 files
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
