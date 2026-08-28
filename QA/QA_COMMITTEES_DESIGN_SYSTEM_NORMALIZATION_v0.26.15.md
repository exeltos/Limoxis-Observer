# v0.26.15 — Committees design-system normalization

## Registry / create
- New Committee no longer navigates to a bespoke full-page create workspace.
- Create opens in the same wide overlay-card/dialog pattern used by operational modules.
- Preserved: committee template, editable legal/role/mandate fields, term dates, quorum, meeting cadence, flexible members, regular/alternate member, voting, personal electronic approval.
- Removed from the active create flow: custom right-side preview, governance assurance card and readiness card.
- Registry summary uses the common module-summary-strip.

## Record
- Primary tab actions now use shared Button rather than raw `action-button`.
- Overview now uses common module-summary metrics + details-grid instead of committee-only governance KPI/watch cards.
- Guidance uses shared details-grid / ExpandableTextBlock instead of custom guidance cards.
- Section eyebrow is Greek/common (`Επιτροπές`).
- Employee references use the shared local employee store, so newly created employees are available.

## Routing
- `/committees/new` UI route is removed from the active app route table; create is initiated from the registry overlay card.
- Existing committee detail routes and workflows are preserved.
