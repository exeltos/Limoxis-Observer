# v0.26.95 — Visual consistency audit

## Purpose
Consolidate the redesign foundation before moving to screen-specific refinement.

## Audit findings
The application already has broad shared-component adoption:
- Button: 136 feature usages
- RecordActions: 12
- FilterBar: 21
- EntityRecordShell: 13
- ObserverDialog: 23
- ManualDateField: 61
- AttachmentField: 9

Raw HTML controls still exist, but they are not mechanically replaced because many are specialist inputs, checkboxes, inline controls and workflow-specific selectors.

## Central polish
A shared surface layer now normalizes:
- surface borders/radius and removes decorative shadows
- button/action geometry
- keyboard focus visibility
- icon button radius
- empty-state geometry
- table/record wrapper border tone
- filter border tone
- common text/surface tokens

This sits above and preserves the previous canonical contracts for registries, detail screens, dialogs/actions, tables and page hierarchy.

## Verification
- Visual consistency audit: 10/10
- Page hierarchy: 7/7
- Tables: 7/7
- Detail screens: 7/7
- Actions/dialogs: 6/6
- Registries: 11 + canonical contract
- Date/time: 0 native feature controls
- Governance foundation: 8/8
- Clinical event: 12/12
- Clinical evidence: 7/7
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
