# v0.26.19 — Documents + New Employee card

## Documents
- Replaced placeholder Documents page with a functional governed registry.
- Common RecordActions: New / Print / Export.
- Shared summary strip, search, type filter and status filter.
- Real document detail route with Summary / Files / History tabs.
- New Document opens as the common wide overlay card, not a separate page.
- Document fields: type, version, owner, scope/department, effective date, review date, description and attachments.
- Draft → Published and Published → Archived lifecycle with explicit confirmation and audit history.
- Document editing is audit logged.
- Attachment changes are audit logged.
- Shared AttachmentField now persists preview data for local/demo files up to 4 MB, so View survives reload.

## Employees
- New Employee now opens as the common wide overlay card from the Employees registry.
- Removed the `/employees/new` active route and dedicated full-page create flow.
- Department/profession continue to come from shared libraries.
- On save, employee is persisted and the real employee record opens.
