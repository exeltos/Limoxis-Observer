# v0.26.99 — Product refinement / Employees registry

## Scope
Daily employee registry and entry into the employee record.

## Changes
- Four compact operational metrics: scoped total, active, inactive, departments.
- Summary metrics now respect `canAccessRecord` instead of counting globally.
- Stable summary/governance → filters → independently scrolling registry.
- Compact KPI treatment aligned with the current Limoxis visual language.
- Employee table keeps sticky headers, shared density, keyboard navigation and contextual-return highlight.
- Create Employee remains the existing dialog workflow and opens the saved employee record after creation.

## Safety
No employee health data, permissions, role behavior, employee persistence, creation workflow or record detail functionality changed.

## Verification
Employee UX 9/9; Patient 9/9; Laboratory 9/9; Surveillance 8/8; visual consistency 10/10; page 7/7; tables 7/7; detail 7/7; actions 6/6; registries 11 + contract; date/time 0 native; governance checks green; permissions 22; navigation 18/18; hooks 137; Observer UI OK; EL/EN 1346/1346.

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
