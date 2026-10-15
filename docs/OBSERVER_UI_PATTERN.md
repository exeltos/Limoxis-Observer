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
- Save / submit actions live in the dialog `footer` (fixed under the scrolling body), never inside the body.
- One way to close: the header × (or Back in workspace dialogs). No extra «Close», «Cancel» or «Later» button that only closes the window; a secondary button must do something else (e.g. cancel an edit in place).
- Windows do not change size when a choice inside them changes: a form that switches between modes (existing/new, single/batch) passes `fixedHeight` to `ObserverDialog`.
- Mode choices at the top of a form use `ModeSwitch`.
- A form has a single scroller: a long list inside a dialog takes the remaining height and is the only part that scrolls.
- Large editable text is handled by `GlobalTextareaExpander` automatically.
- Large read-only text uses `ExpandableTextBlock`.
- Feature-specific workflows may add domain sections, but may not redefine basic controls.

## Registries and records
- Registries use `Page`, `FilterBar`, `RecordActions`, and clickable-row affordance where rows open records.
- Record pages use `EntityRecordShell`.
- Lists inside a record use `RegistryTable` (same geometry as registries); statuses use `status-badge`, never plain text.
- Sections inside a record tab start with `SectionHeader` (title, optional subtitle, actions on the right).
- Field titles, editable or read-only, use the `lo-field-label` style (Field, ManualDateField, TimeField, SearchableSelect, RecordDetailsGrid apply it).
- Multi-choice fields use `ChoiceChips`, not checkboxes in pills.
- An empty registry shows the RegistryTable empty state under the column headings and hides pagination.
- A nested view inside a record (e.g. an episode inside a tab) shows its path with `Breadcrumbs` instead of a second Back button.
- Status badges, table geometry and row actions must use existing Observer primitives before new CSS is introduced.

## Committee-specific rule
Committees may add governance content (membership history, quorum, minutes, approvals, action follow-up), but all of it must remain inside the Observer patterns above. There is no separate “committee design system”.
