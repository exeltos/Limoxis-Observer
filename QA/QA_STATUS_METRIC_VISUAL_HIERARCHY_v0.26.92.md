# v0.26.92 — UX refinement batch 6 / Status, KPI & visual hierarchy

## Central semantic tokens
Added shared success, info, warning, danger and neutral status tokens plus metric icon/value tokens in `theme.css`.

## Status badges
All existing `status-badge` usages inherit one compact geometry, border and semantic palette. Existing active/success, warning/temporary and danger/risk states are mapped centrally without per-page CSS.

## KPI / summary cards
Dashboard KPI cards and module summary metrics now share a calmer hospital-software hierarchy: reduced height/padding, consistent 12px radius, no decorative shadow, unified metric value typography and token-driven icon treatment. Environmental, Indicator and Bundle summary cards also inherit the common surface/border treatment.

## Verification
- Status/metric consistency: 10/10
- Detail screen consistency: 7/7
- Action/dialog consistency: 6/6
- Registry UX consistency: 11 registries + canonical scroll contract
- Date/time consistency: 0 native feature controls
- Observer UI: OK
- English parity: 1346/1346

Full dependency-backed `npm run check` was not run because dependencies are not included in the release archive.
