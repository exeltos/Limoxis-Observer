# v0.27.0 — Product refinement / Employee record

## Scope
Detailed employee record refinement across administrative data and role-gated health/workforce tabs.

## Changes
- Added a compact sticky record-facts strip below the record header: department, professional category, hire date, employment status.
- Facts are derived from the already-authorized employee record and do not expose new data.
- Detail grid density and spacing normalized.
- Occupational health, vaccination, training and evaluation subcards receive the shared compact card hierarchy.
- Inline employee edit keeps its existing behavior but actions remain visible through a sticky save/cancel footer.
- Existing tab visibility continues to use occupational-health, training, staff-admin and sensitive-health permissions.

## Preserved
No sensitive-health permission rule, employee health content, vaccination/occupational data model, save logic, committee approval behavior, surveillance flow, deletion confirmation or navigation contract changed.

## Verification
Employee record 9/9; employee registry 9/9; patients 9/9; laboratory 9/9; surveillance 8/8; visual 10/10; page 7/7; tables 7/7; detail 7/7; actions 6/6; registries 11 + contract; date/time 0 native; governance checks green; permissions 22; navigation 18/18; hooks 137; Observer UI OK; EL/EN 1346/1346.

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
