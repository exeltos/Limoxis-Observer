# v0.27.4 — Metric Card Consistency

The previous pass normalized outer dimensions but did not truly unify internal card markup. This release replaces module-specific KPI markup with one `MetricCard` component.

Canonical contract:
- exact 96px height
- 12px radius
- 14x15px padding
- 38px icon tile
- 18px icon, stroke-width 2
- value 21px / 780
- label 10.5px / 700
- 12px icon/content gap
- four-column summary grid, responsive 2/1 columns

Migrated: Laboratory, Patients, Controls, Quality, Documents, Employees, Occupational Health, Prevention, Surveillance, Training, Committees and Committee record.

Patients now also use the same icon pattern instead of text-only summary cards.
