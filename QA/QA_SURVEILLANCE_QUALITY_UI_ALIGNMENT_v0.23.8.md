# Surveillance + Quality UI Alignment — v0.23.8

## Surveillance
- Replaced oversized white KPI cards with the compact shared module summary strip.
- Surveillance categories are always represented in the category navigation.
- Patients, Employees, Bulk employee surveillance and Environment use one common tab language.
- Sensitive Employee surveillance remains protected: unauthorized roles see the category locked, not its data/count.
- Existing role/data-access rules were not weakened.
- Registry remains the primary scrollable surface.

## Quality
- Replaced the isolated large primary "New" button with the common Create / Print / Export action pattern.
- Print and filtered CSV export are functional.
- Added the same compact module summary strip.
- Quality section tabs now use the same shared module-tab visual language as Surveillance.
- Existing per-section filters, registry navigation and permissions remain intact.

## Design-system direction
`module-summary-strip` and `module-tabs` are now reusable patterns for registry-centered modules.
Do not introduce large dashboard cards inside operational registries unless the information genuinely needs dashboard emphasis.
