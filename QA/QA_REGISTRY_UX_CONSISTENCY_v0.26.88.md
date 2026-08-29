# v0.26.88 — UX refinement batch 2 / Registries, filters & scrolling

## Goal
Normalize the daily-use registry pattern across Limoxis Observer:
- screen chrome remains stable
- summary/actions and filters remain visible
- only the result list/table scrolls
- table headers remain visible while scrolling

## Canonical registry scroll contract
A shared registry workspace rule was added to the central stylesheet:
- flex column with `min-height:0`
- filter area is non-scrolling
- result table owns the remaining height and scroll
- `overscroll-behavior: contain`
- stable scrollbar gutter on desktop
- sticky table header cells

This is a central pattern, not page-specific CSS.

## Registry normalization
Explicit `registry-workspace` adoption was added where needed to:
- Employees
- Controls
- Documents
- Training
- Occupational Health
- Prevention
- Committees
- Quality

Patients and Laboratory already had dedicated fixed registry shells. Indicators already used a workspace-fill registry. The shared CSS contract also protects direct FilterBar + scroll-table surfaces.

## Filters
The primary registries were audited for shared `FilterBar` coverage. The regression checker now verifies the core registry set has both filtering and a dedicated scrolling result area.

## Verification
- Registry UX consistency: 11 registries + canonical scroll contract
- Date/time consistency: 0 native feature controls
- Governance foundation: 8/8
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Clinical/Lab/Product i18n
- Observer UI
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because dependencies are not included in the release archive.
