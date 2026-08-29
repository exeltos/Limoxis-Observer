# v0.26.81 — Governance lifecycle classification

## Result
Reviewed remaining high-state modules after Prevention, Quality and Laboratory migration.

The review intentionally avoids applying generic reopen/void mechanics everywhere.

### Shared governed lifecycle
Appropriate for finalized evidence:
- Prevention
- Quality
- Laboratory

### Domain-specific lifecycle retained
- Controls: execution history with audited edit/void.
- Documents: Draft → Published → Archived; published content requires revision/supersede, not in-place reopen.
- Committees: approval/minutes lifecycle.
- Training: attendance/assessment/certificate-specific evidence.
- Clinical surveillance: multiple clinical state machines, not one record-level lifecycle.

## Changes
Document governance traceability strengthened:
- publication stores `publishedById`
- archival stores `archivedAt`, `archivedBy`, `archivedById`

Controls were inspected and already retain stable `editedById` and `cancelledById`, so no unnecessary rewrite was introduced.

## Verification
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
