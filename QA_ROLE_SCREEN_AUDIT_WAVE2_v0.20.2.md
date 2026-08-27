# Role Screen Audit — Wave 2 — v0.20.2

## Patients
Patient registry now applies central organization/department record scope before search and filters.

## Employees
Employee registry applies central scope. Administrative employee access is separated from sensitive employee-health access.

Hospital Admin / HR administrative capability no longer implies access to employee screening. Employee surveillance tab and new screening action require the sensitive employee-health policy.

## Occupational Health
Visits and vaccination queues are filtered through employee record scope.

## Prevention
Prevention registries use the central record scope and retain capability-gated creation actions.

## Security boundary
These are frontend UX/access rules. Final Supabase RLS must mirror organization, department, self and sensitive-health policies before production.
