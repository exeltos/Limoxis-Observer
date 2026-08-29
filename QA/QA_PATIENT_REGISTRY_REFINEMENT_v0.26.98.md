# v0.26.98 — Product refinement / Patients

## Scope
Refinement of the patient registry and new-patient intake, completing the first pass of the Patient → Surveillance → Laboratory daily axis.

## Changes
- Compact four-metric scoped patient summary: total, active, discharged, transferred.
- Stable summary → filters → independently scrolling patient table.
- Patient table keeps shared density, sticky headers, contextual return highlighting and keyboard navigation.
- Registry filter area is visually integrated with the table surface.
- New-patient form keeps the existing fields and workflow but receives tighter vertical rhythm and a sticky action footer.
- Existing ManualDateField controls remain unchanged.

## Scope safety
Summary counts respect the current tenant/record scope through `canAccessRecord`.
No patient data model, permissions, create behavior, navigation contract or clinical workflow changed.

## Verification
Patient UX 9/9; Laboratory 9/9; Surveillance 8/8; Visual consistency 10/10; hierarchy 7/7; tables 7/7; detail 7/7; actions 6/6; registries 11 + contract; date/time 0 native; governance checks green; permissions 22; navigation 18/18; hooks 137; Observer UI OK; EL/EN 1346/1346.

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
