# v0.26.96 — Product refinement / Surveillance workspace

## Goal
Begin screen-by-screen refinement with the highest-use clinical surveillance workspace.

## Patient surveillance registry
The custom patient registry now visually follows the same density and hierarchy as the shared table system:
- sticky registry header
- compact 46px-class rows
- consistent primary/secondary typography
- stable seven-column geometry
- clear hover and keyboard focus
- preserved contextual-return highlight
- compact status badges
- horizontal overflow only when necessary

## Workspace behavior
The surveillance screen is treated as three stable zones:
1. summary/governance context
2. domain tabs
3. active registry workspace

The patient workspace keeps filters fixed above the independently scrolling result list.

## Preserved behavior
No clinical workflow, role/scope rule, creation flow, row navigation, audit lifecycle or surveillance data model was changed.

## Verification
- Surveillance workspace UX: 8/8
- Visual consistency: 10/10
- Page hierarchy: 7/7
- Tables: 7/7
- Detail screens: 7/7
- Actions/dialogs: 6/6
- Registries: 11 + canonical contract
- Date/time: 0 native feature controls
- Governance foundation: 8/8
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI: OK
- English parity: 1346/1346

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
