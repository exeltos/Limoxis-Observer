# v0.26.94 — UX refinement batch 8 / Page headers, section hierarchy & typography

## Scope
Central visual hierarchy refinement across Limoxis Observer.

## Changes
- Standardized page padding and page-header geometry.
- Unified H1 typography, subtitle size, line height and maximum readable width.
- Standardized page action alignment.
- Unified eyebrow treatment for compact contextual metadata.
- Standardized section-head / section-header title, subtitle and spacing hierarchy.
- Tightened workspace-summary spacing.
- Added responsive reductions for smaller viewports.

The rules are central in `global.css`; no module-specific redesign was introduced.

## Verification
- Page hierarchy consistency: 7/7
- Table UX consistency: 7/7
- Detail screen consistency: 7/7
- Action/dialog consistency: 6/6
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
- Observer UI
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because dependencies are not included in the release archive.
