# Limoxis Observer — canonical UI pattern

This file is the product-wide interaction contract for new and existing features.

## Actions
- Primary domain action: standard text button (`Button` / `.action-button`).
- Print: icon-only printer button with tooltip + aria-label.
- Export: icon-only download button with tooltip + aria-label.
- Back / close / row utilities: icon-only controls using the same Observer control size and radius.
- Do not create feature-specific print/export button styles.

## Forms and dialogs
- Modal forms use `ObserverDialog` (built on the Observer `entry-card` language).
- Fields use the shared Observer input/select/textarea geometry.
- Dates use `ManualDateField` (`dd/mm/yyyy` + calendar picker).
- Footer order is consistent: secondary cancel/close, then primary save/complete.
- Large editable text is handled by `GlobalTextareaExpander` automatically.
- Large read-only text uses `ExpandableTextBlock`.
- Feature-specific workflows may add domain sections, but may not redefine basic controls.

## Registries and records
- Registries use `Page`, `FilterBar`, `RecordActions`, and clickable-row affordance where rows open records.
- Record pages use `EntityRecordShell`.
- Status badges, table geometry and row actions must use existing Observer primitives before new CSS is introduced.

## Committee-specific rule
Committees may add governance content (membership history, quorum, minutes, approvals, action follow-up), but all of it must remain inside the Observer patterns above. There is no separate “committee design system”.
