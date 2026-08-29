# v0.26.87 — UX refinement batch 1 / Date control consistency

## Scope
First UX refinement batch after governance foundation stabilization.

## Changes
The final browser-native date inputs in feature screens were removed.

### Employees
The employee hire-date editor now uses the shared `ManualDateField`, matching the rest of the employee health and platform date experience.

### Quality
Capa due date, effectiveness due date and audit planned date now use `ManualDateField` rather than native browser date inputs.

Read-only display remains localized through the existing formatting helpers.

## Platform rule
Feature screens must not introduce raw browser `type="date"` or `type="time"` controls. Use the shared date/time design-system controls so appearance and behavior remain stable across browsers and modules.

A new regression checker enforces this rule across `src/features`.

## Verification
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
