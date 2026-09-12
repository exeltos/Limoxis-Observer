# v0.45.0 — Clean Registry Architecture

This pass removes the accumulated v0.43/v0.44 CSS overrides and keeps one authoritative surveillance/registry layout contract.

- Removed unused `src/styles/app.css`.
- Removed dangling `management-roles-refinement.css` import from `modules.css`.
- Replaced duplicate v0.43/v0.44 surveillance CSS blocks with one v0.45 block.
- Environment type (All / Surfaces / Water) exists only inside the Filter popover in the production Surveillance Center.
- Selected organization is rendered by `AppShell` in the persistent top header; no page-level organization selector is rendered by `ProductionSurveillancePage`.
- Main paginated registries consume remaining viewport height; table body scrolls and pagination stays at the bottom.
- No Supabase schema/policy/data changes in this pass.
