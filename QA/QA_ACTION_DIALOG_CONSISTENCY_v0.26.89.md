# v0.26.89 — UX refinement batch 3 / Actions & dialogs

## Goal
Normalize action hierarchy without redesigning individual workflows.

## Dialog actions
The shared `DialogActions` now supports a custom cancel/close label while preserving the standard secondary Cancel + primary Save pattern.

The Committee meeting/minutes dialog was migrated from an ad-hoc footer to the shared action system:
- Cancel
- Save
- Complete & send for approval

The completion action remains explicit because it changes workflow state; Save remains a normal draft/update action.

## Inline row actions
A central visual contract was added for `record-inline-actions`:
- compact 32px icon buttons
- consistent spacing and alignment
- shared hover/focus geometry
- destructive actions remain visually distinct
- no page-specific button sizing required

## Dialog footer
Observer dialog footers now share central alignment, spacing, wrapping and minimum action height.

## Verification
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
