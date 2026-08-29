# v0.26.90 — UX refinement batch 4 / Detail screens, tabs & spacing

## Goal
Give every record/detail screen the same visual rhythm through the shared `EntityRecordShell`, without page-specific redesigns.

## Canonical detail screen
`EntityRecordShell` now carries the semantic `canonical-detail-screen` contract.

The central stylesheet defines:
- fixed record header
- fixed tab navigation
- independently scrolling record body
- compact consistent header spacing
- unified title/subtitle typography
- compact tab height, spacing and active state
- horizontal tab scrolling when many tabs exist
- stable desktop scrollbar geometry
- consistent record-section separation
- responsive spacing on smaller screens

## Result
All record screens already built on `EntityRecordShell` inherit the same design automatically, including:
- Patients / clinical surveillance
- Employees
- Laboratory
- Prevention
- Quality
- Controls
- Committees
- Documents

This keeps redesign changes central and avoids separate CSS per module.

## Verification
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
- Clinical/Lab/Product i18n
- Observer UI
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because dependencies are not included in the release archive.
