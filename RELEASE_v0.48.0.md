# Limoxis Observer v0.48.0 — Classic Rebase & Product Cleanup

## Direction
This release intentionally returns to the complete v0.47.6 application as the product base. The later Foundation rebuild is **not** the visual or interaction baseline for this branch.

The goal is to preserve the stronger, richer application that already existed and improve it incrementally instead of rebuilding every module as a simplified screen.

## Preserved from the mature application
- role-aware dashboard, login briefing and in-app manual/help center
- LIRA assistant and analysis data layer
- full Prevention workflows (WHO hand hygiene, bundles, antiseptic consumption, waste)
- Training programs, participants, assessments and access flows
- Committees, meetings, attendance, minutes, decisions and governance
- Controlled Documents, approvals, versions and review lifecycle
- Controls, patient, laboratory, employee, occupational-health, pharmacy and management modules
- centralized permissions/capabilities and Supabase services
- registry memory, row return/highlight, fixed-list scrolling and compact advanced filters

## v0.48.0 cleanup
- preserved the canonical **single Filters button** popover pattern
- added a light shared visual refinement layer instead of module-by-module redesign
- Greek-first terminology cleanup across core product labels, prevention and help content
- WHO hand-hygiene Greek UI no longer presents HR/HW/Missed as unexplained English labels
- Bundles are presented as **Δέσμες μέτρων** / **Πλήρης συμμόρφωση** in Greek UI while internal data keys remain unchanged
- Documents now show **Αναθεώρηση** rather than English Review in Greek UI
- Prevention now exposes compact links to staff vaccination and antimicrobial-stewardship workflows when the role has access, without duplicating their data
- added shared responsive/overflow safeguards so list/form surfaces do not regress into nested horizontal scrollbars

## Data / Supabase
No live Supabase schema change is included or automatically applied in this release. Existing cloud services and RLS model of the mature application remain intact.

## Important
This is a **rebase**, not a merge of every experimental screen from v0.50–v0.57. Future work should start here and bring over only clinically/operationally valuable improvements after they are adapted to this richer design system.
