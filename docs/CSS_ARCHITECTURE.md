# CSS architecture

Global styles are five stylesheets imported by `src/main.jsx`, in this order.
The order is the cascade order: later files, and later sections within a file,
win over earlier ones at equal specificity.

| File | Contents |
|---|---|
| `src/styles/foundation.css` | Design tokens (`theme`), base layout and core components (`core`), sidebar/back navigation (`design-system-navigation`) |
| `src/styles/features.css` | Feature screens (`modules`, `modern`), registries (`registry`), patient record (`patient-record`), surveillance workflow (`surveillance-workflow-preview`), sign-in pages (`auth`) |
| `src/styles/design-system.css` | Canonical shared patterns: `classic-rebase`, action buttons and dialogs (`design-system-actions`), Platform Owner screens (`platform-owner-polish`), canonical registry visuals |
| `src/styles/workspaces.css` | Workspace-level refinements: filter bar, training, prevention, surveillance dropdowns and flow, patient workspace, clinical loading states, record tabs |
| `src/styles/responsive.css` | Analysis/print, unified tabs, short screens, tablet rail and phone layout, returned-row highlight — kept last so they can adapt everything above |

Each file is split into sections marked `/* ==== <section> ==== */`; the
section names are the stylesheets these files were consolidated from on
2026-09-25, so older commits and tests remain easy to trace.

Component-scoped stylesheets (`src/design-system/*.css`, feature `*.css`) are
imported by their components and load with them.

## Rules for changes

- Put a new rule in the section of the screen or component it styles, not in a
  new file appended at the end.
- Do not reorder sections or move rules between them without checking computed
  styles before/after: moving a rule changes which declaration wins.
- `npm run audit:dead-css` (part of `npm run check`) fails when a declaration
  is overridden by a later rule with the identical selector in the same
  context. `npm run css:prune` removes such declarations; the result is
  cascade-identical by construction.

## Consolidation of 2026-09-25

1. 2,734 overridden declarations and 546 empty rules removed (`css:prune`).
2. 193 declarations moved from later same-selector rules back into their
   original rule, only where no declaration of the same property family
   (any selector, any context) sits between the two positions, so no element's
   cascade can change.
3. 26 stylesheets concatenated, in unchanged order, into the five files above.

Verified by comparing the computed style of every element and the screenshot
pixels of the previous and the new build on every main screen at three
viewport sizes, in Greek and English, with create dialogs, filter panels,
notifications and every patient-record tab open.

Result: 76 states, 31,666 elements, **0 computed-style differences**. Screenshot
pixel differences (at most 130 pixels, colour delta ≤ 30/255) were at the same
noise level as comparing the previous build with itself (up to 712 pixels in
24 of 76 states), i.e. anti-aliasing noise, not layout or colour changes.
