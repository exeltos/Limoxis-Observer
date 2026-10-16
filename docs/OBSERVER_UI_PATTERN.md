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

## Lists, libraries and smart fields
- Option lists come from the central libraries (Management > Libraries) through `useLibraries()` / `useDepartments()` (`features/management/useLibraries.js`), never from arrays written into a screen. Records store the library's Greek name or a code, never the label the screen happened to show.
- One pick from a list: `SearchableSelect` (type to filter). `recentValues` puts the usual choices first (earlier entries, the chosen departments' staff); `allowCustom` keeps a typed value the library does not have yet. Several picks: `MultiSelect`. Registry filters: `FilterSelect`.
- Two or three exclusive answers (Yes / No / N/A, criticality, a status answer): `ModeSwitch` or `YesNoField`, as large touch targets. Toggles that can be on together: `ChoiceChips`. No raw `<select>`, checkbox or `<datalist>` in feature screens; `npm run audit:observer-ui` holds each module's count to a ceiling that only goes down (Controls, Surveillance, Patients, Laboratory and Prevention: zero).
- Status labels use `StatusBadge` (`success`, `info`, `warning`, `danger`, `neutral`). Dates with time use `formatDateTime`, calendar days `formatDay` (`core/i18n/formatDay.js`).
- Screens are checked at laptop (1366×768) and tablet (1024×768, 820×1180) sizes: cards fall to one column, tables scroll inside their own frame, and the save bar stays in view.

## Registries and records
- Registries use `Page`, `FilterBar`, `RecordActions`, and clickable-row affordance where rows open records.
- Record pages use `EntityRecordShell`.
- Lists inside a record use `RegistryTable` (same geometry as registries); statuses use `status-badge`, never plain text.
- Sections inside a record tab start with `SectionHeader` (title, optional subtitle, actions on the right).
- A record tab with a list (assessments, surveillance & samples, history) is a `RecordTabPanel`: it fills the record body (no card inside the card), one header row, content that scrolls inside, pagination kept at the bottom — the same look as the registry lists.
- Documents tabs, and attachments everywhere, use `DocumentsWorkspace` / `AttachmentField`: the titled section with the shared «Attachments» box and «Add attachment».
- A record's read view is a `record-view-stack`: `SectionHeader`, the context as a `RecordDetailsGrid` sheet, the key figures as a `RecordMetricStrip`, then the record's own list. Dates read dd/mm/yyyy (and HH:MM).
- In forms every control (text, select, date, time) is 40px high and fields in a row line up; yes/no answers use `YesNoField`, months `MonthField`.
- Field titles, editable or read-only, use the `lo-field-label` style (Field, ManualDateField, TimeField, SearchableSelect, RecordDetailsGrid apply it).
- Multi-choice fields use `ChoiceChips`, not checkboxes in pills.
- An empty registry shows the RegistryTable empty state under the column headings and hides pagination.
- A nested view inside a record (e.g. an episode inside a tab) shows its path with `Breadcrumbs` instead of a second Back button.
- Status badges, table geometry and row actions must use existing Observer primitives before new CSS is introduced.

## Committee-specific rule
Committees may add governance content (membership history, quorum, minutes, approvals, action follow-up), but all of it must remain inside the Observer patterns above. There is no separate “committee design system”.
