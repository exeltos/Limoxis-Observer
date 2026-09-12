# Limoxis Observer v0.40.0 — Full Refactor Baseline

This build keeps the mature functional code from the supplied legacy project and replaces the accumulated visual patch architecture with a controlled central cascade.

## Central style architecture
Only four application stylesheets remain:
1. `src/styles/theme.css` — semantic tokens and sizing variables.
2. `src/styles/core.css` — preserved shared/layout/design-system legacy rules in deterministic order.
3. `src/styles/modules.css` — preserved module-specific rules, consolidated in one place.
4. `src/styles/modern.css` — the new unified clinical UI contract and the only approved override layer.

Do not add `polish.css`, `fix.css`, `refinement.css`, or page-specific visual patches. A reusable change belongs in `theme.css` or `modern.css`; a genuine module-only layout belongs in the appropriate labelled section of `modules.css`.

## Refactor pass by area
- App shell: compact navy navigation, quiet white topbar, reduced visual chrome.
- Dashboard/analytics: smaller KPIs/cards and unified surface geometry.
- Surveillance: unified patient, employee, bulk employee and environmental registries; compact tabs/tables/statuses/forms.
- Laboratory: unified queue, tables, result records, AST/AMR forms and clinical record shell styling.
- Prevention: unified hand hygiene, bundles, waste and antiseptic forms/records.
- Controls: unified registry/editor/record spacing and controls.
- Patients & Employees: consistent registries, row navigation, record shells, tabs and forms.
- Quality: consistent registry/create/detail surfaces.
- Training: consolidated historical workspace and participant visual patches into the central module layer.
- Committees: consolidated record/dialog/member table styling.
- Documents: shared registry/record/action styles.
- Indicators & Analysis: shared cards, inputs, tables and chart containers.
- Management/Studio: consolidated users, roles, questionnaires, libraries, environmental standards, bed-days, indicators and bundle library CSS.
- Platform Owner: unified platform registry/record/control-plane styling.
- Pharmacy & Occupational Health: shared page/form/table language.
- Authentication/account/help/LIRA: normalized controls, typography and surfaces.

## UI contract
- Dense professional hospital UI; content has priority over decoration.
- One navy navigation family; no arbitrary module color themes.
- 34px default controls, 7px control radius, 9–10px surface radius.
- Page titles around 20px, module section titles around 13–15px.
- Compact search plus filter trigger/popover pattern.
- Tables use compact sticky headers and row-click affordance.
- Destructive operations remain governed by existing confirmation logic.
- Record navigation/back-state and capability/RLS architecture are preserved.
- Existing EL/EN i18n architecture is preserved.

## Validation performed
- All relative JS/JSX imports resolve after stylesheet consolidation.
- All feature-level CSS imports were removed and consolidated centrally.
- CSS file count reduced from 52 to 4.
- No dependency was added or upgraded.
- `npm ci` could not finish in the artifact runtime because package installation timed out; therefore a full Vite production build is not falsely claimed here.
