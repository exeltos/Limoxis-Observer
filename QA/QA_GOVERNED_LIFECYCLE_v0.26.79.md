# v0.26.79 — Governed lifecycle migration, batch 1

## Scope
First production-flow migration onto the shared governed lifecycle foundation.

## Prevention
- Void now uses the common `voidRecord` lifecycle helper.
- Correction opening uses the common `openCorrection` helper.
- Correction records actor name, actor ID, timestamp and mandatory reason before edit begins.
- Saving the corrected record returns it to active lifecycle state while retaining correction metadata and revision history.
- Prevention continues to use `revisionHistory` as its historical evidence container.

## Quality
- Void now uses the common `voidRecord` helper.
- Correction opening uses `openCorrection`.
- Correction save returns the record to active state while preserving both lifecycle event and domain edit event.
- Existing non-destructive audit behavior is preserved.

## Shared behavior
No physical deletion of governed records.
Correction requires reason before unlocking the edit flow.
Stable actor IDs remain part of every governed transition.

## Verification
- Governed lifecycle contract: 7/7
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
