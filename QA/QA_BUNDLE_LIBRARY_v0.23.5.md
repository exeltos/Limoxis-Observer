# Bundle Library + Extended Clinical Bundles — v0.23.5

## Library governance
- Added Prevention Bundles as a dedicated Library category.
- Six initial published system templates: CLABSI, CAUTI, VAP/VAE, SSI, Peripheral IV, Hemodialysis.
- Bundle metadata: code, EL/EN title, version, status, scope, official-source label, source/review version, applicable departments.
- Element metadata: EL/EN label, required flag and controlled order.
- States: Draft / Published / Retired.
- Published and retired versions are view-only; changes require a draft copy/new version.
- Publish and retire require confirmation and preserve previous versions.
- Library changes persist in localStorage in local/demo mode.

## Execution linkage
- New executions load only Published Library templates.
- Every completed execution stores a templateSnapshot plus template id/version/source.
- Historical detail views prefer the stored snapshot so later Library changes cannot rewrite prior evidence.
- Existing score and all-or-none calculations remain separate.
- Any No remains a structured finding.

## Added clinical families
- Peripheral IV: indication, HH, aseptic no-touch technique, skin antisepsis, daily site review, hub disinfection, dressing/fixation, timely removal.
- Hemodialysis: HH, aseptic access handling, hub disinfection, access-site assessment, dressing care, aseptic medication preparation, station/equipment disinfection, infection-event review.

## Backend requirement
Supabase phase must persist bundle_template, bundle_template_version, bundle_element and bundle_execution_snapshot separately, with RLS and immutable published/executed records.
