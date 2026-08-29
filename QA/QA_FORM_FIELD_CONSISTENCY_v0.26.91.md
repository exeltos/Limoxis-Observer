# v0.26.91 — UX refinement batch 5 / Forms & fields

## Goal
Centralize form geometry and interaction states without changing workflow semantics.

## Shared field contract
Feature forms inside standard grids, dialogs and record bodies now inherit one central contract for text inputs, selects and textareas:
- 40px compact field height
- 9px radius
- shared border/focus ring
- consistent label typography
- predictable disabled and placeholder states
- textareas use consistent padding, line-height and vertical resize

Checkbox/radio and specialized clinical option controls are deliberately excluded from the generic field selector. Existing specialized module controls remain intact.

## Empty states
Inline empty states now use a compact, stable minimum area with centered readable messaging instead of variable-height blank gaps.

## Verification
- Form/field consistency: 6/6
- Detail screen consistency: 7/7
- Action/dialog consistency: 6/6
- Registry UX consistency: 11 registries + canonical scroll contract
- Date/time consistency: 0 native feature controls
- Observer UI audit: OK
- React hooks: 137
- English parity: 1346/1346

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
