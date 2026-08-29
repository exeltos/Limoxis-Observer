# v0.26.93 — UX refinement batch 7 / Tables, row density & information hierarchy

## Goal
Improve large hospital registries and record tables without removing information.

## Central table contract
The shared stylesheet now normalizes `data-table` and `record-table`:
- compact 12px body typography
- 9.5px uppercase table headings
- consistent row/cell padding
- clearer primary vs secondary text
- subdued metadata text
- stable 42px-class row rhythm
- shared hover behavior
- stronger selected-row state
- compact action column
- minimum table width inside scrolling containers
- responsive density adjustment

## Design principle
The change is central rather than module-specific. Existing specialist tables keep their semantic columns and workflow logic; only the common visual hierarchy is normalized.

## Verification
- Table UX consistency: 7/7
- Detail screen consistency: 7/7
- Action/dialog consistency: 6/6
- Registry UX consistency: 11 registries + canonical scroll contract
- Date/time consistency: 0 native feature controls
- Governance foundation: 8/8
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because dependencies are not included in the release archive.
