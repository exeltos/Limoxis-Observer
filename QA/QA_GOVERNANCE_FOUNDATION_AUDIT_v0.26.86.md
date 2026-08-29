# v0.26.86 — Governance foundation audit

## Scope
Platform-wide static review after the governance batches, focused on evidence immutability, actor traceability, finalized states and physical-delete risks.

## Findings corrected

### Prevention evidence
Waste measurements, antiseptic consumption records and Bundle executions already behaved as completed evidence, but their lifecycle state was implicit.
They now explicitly persist:
- `lifecycleStatus: finalized`
- `finalizedAt`
- `finalizedBy`
- `finalizedById`

Existing finalization metadata is preserved when editing through a governed correction path.

### Prevention Bundle library
A governance inconsistency was found in template management:
- published/retired/system Bundle templates could be physically filtered out of the hospital library.

This is corrected:
- governed templates are now locally hidden, not physically destroyed
- `hiddenAt`, `hiddenBy`, `hiddenById` are retained
- hidden templates are excluded from the active library view
- draft/local templates may still be physically removed after confirmation
- publish now stores `publishedBy` / `publishedById`
- retire now stores `retiredBy` / `retiredById`

Existing Bundle executions remain linked to their template snapshot/version.

## Reviewed but deliberately not changed
Several `.filter(id !== ...)` operations remain in the codebase. They are not all governance violations:
- temporary form rows/topics
- draft/local configuration
- non-evidence UI collections
- participant removal where history already records the action

They should not be mechanically converted to void/archive.

## Verification
- Governance foundation audit: 8/8
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Clinical/Lab/Product i18n
- Observer UI
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because `node_modules` is intentionally not included in the release archive.
