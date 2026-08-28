# Prevention functional wave 1 — v0.22.3

## Controls
- Top-right action pattern now includes Create, Print and Export.
- Print uses the current filtered registry view.
- Export creates a CSV from the current filtered registry and confirms via shared feedback.

## Prevention Center
- Create is now functional in all four tabs instead of only showing a notification.
- Hand Hygiene entry: date, department, professional category, observations, compliant observations; compliance is calculated automatically; observer comes from login.
- Waste entry: date, department, waste type, weight and containers.
- Antiseptic entry: period, department, product and litres.
- Bundle entry: period, department, bundle and compliance score.
- New entries are inserted immediately into the active registry and KPIs update.
- Department-scoped roles are locked to their own department; hospital-wide roles may choose department.
- Actor identity is recorded from the authenticated profile/session.
- Print and Export are functional for the active Prevention tab and current filters.
- Success actions use the shared environment-aware feedback pattern.
