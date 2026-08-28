# Role Screen Audit v0.20.1

Applied the central role/scope policy to the first cross-role screens.

- Surveillance registry now filters patient records through central record scope.
- Employee screening tabs are hidden from roles without sensitive employee-health access.
- Environmental surveillance is hidden from Department and Doctor Reviewer workspaces.
- Laboratory registry uses the central record-scope filter.
- Department workspace is no longer a placeholder and explicitly presents department-only work.
- Existing capability-gated actions in Laboratory remain authoritative for result entry, validation, critical communication, classification and reopening.

Next audit wave: Patients / Employees / Occupational Health / Prevention, then Quality / Committees / Training / Documents / Management.

Supabase RLS remains required before production; frontend scope is not a security boundary.
