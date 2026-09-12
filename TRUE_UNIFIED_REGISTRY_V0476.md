# v0.47.6 — True Unified Registry

Top-level paginated lists now share one React component and one CSS contract.

## Single source of truth
- `src/design-system/PaginatedRegistry.jsx`
- `src/styles/registry.css`

## Migrated in this pass
- Patients registry
- Laboratory registry
- Surveillance center registry (Patients / Employees / Environment)

The component owns toolbar placement, body geometry, empty/loading states and pagination placement. Modules only provide domain columns and row content.

## Behavior
- no module-specific vertical list scrollbar
- same full-width/full-height surface
- same filter bar geometry
- same table header/row density
- same empty-state placement
- same pagination footer at the bottom

Domain titles, KPI meanings and column labels intentionally remain domain-specific; their visual system is shared.
