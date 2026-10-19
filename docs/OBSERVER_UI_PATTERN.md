# Limoxis Observer — canonical UI pattern

This file is the product-wide interaction contract for new and existing features.

## Actions
- Primary domain action: standard text button (`Button` / `.action-button`).
- Print, PDF, Excel and Word go through ONE control, `ExportMenu` («Εξαγωγή ▾», EN "Export"), the same on list pages (page header, top right), record headers (beside the status) and dialogs. It lists only the options that apply, always in the order Εκτύπωση, PDF, Excel, Word (a record's raw data file, JSON, last). With one option the button runs it directly, still labelled «Εξαγωγή». In a table row it is `compact` (an icon with the «Εξαγωγή: …» tooltip). No standalone print / download / «Λήψη» buttons or «…»-menu items: `npm run audit:observer-ui` flags them.
- PDF of a document built on the shared layout (`core/export/reportDocument.js`) opens the same print view with a «Αποθήκευση ως PDF» hint (`printReport(doc, { pdf: true })`, or `reportExports(build, { word })` for the Print / PDF / Word set), so the file keeps real text. Screens without a built document keep their own PDF file (`exportElementAsPdf`).
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
- A field with a choice of values (status, priority, type, attendance, criticality, a check's answer…) is one house select: `ChoiceField` / `SearchableSelect` in forms, `FilterSelect` in list toolbars — never a row of buttons per field. A yes / no flag (required, active, reviewed, update existing…) is a checkbox: `CheckboxField` (or `YesNoField`, which renders it). `ModeSwitch` stays only for a two-way mode or view switch at the top of a form or list (single / bulk, list / programme); `npm run audit:observer-ui` flags a `ModeSwitch` with three or more options. Toggles that can be on together: `ChoiceChips`. No raw `<select>`, checkbox or `<datalist>` in feature screens; `npm run audit:observer-ui` holds each module's count to a ceiling that only goes down (Controls, Surveillance, Patients, Laboratory, Prevention, Quality, Registers, Documents, Indicators, Employees and Calendar: zero; Training and Committees still have a few and only go down).
- Status labels use `StatusBadge` (`success`, `info`, `warning`, `danger`, `neutral`). Dates with time use `formatDateTime`, calendar days `formatDay` (`core/i18n/formatDay.js`).
- Screens are checked at laptop (1366×768) and tablet (1024×768, 820×1180) sizes: cards fall to one column, tables scroll inside their own frame, and the save bar stays in view.

## Registries and records
- Registries use `Page`, `FilterBar`, `RecordActions`, and clickable-row affordance where rows open records.
- Record pages use `EntityRecordShell`. Its header actions come in three kinds: edit and delete go to the «…» menu; the record's `ExportMenu` stays visible beside the status.
- Printed and downloaded documents use the shared layout in `core/export/reportDocument.js` (`printReport` for PDF with real text, `downloadReportWord` for .doc): hospital band, title and code, facts grid, numbered sections with real tables, signatures, and a footer with the code, printed-on date, page X / Y and the DEMO mark. No screenshot PDFs for new exports.
- Lists inside a record use `RegistryTable` (same geometry as registries); statuses use `status-badge`, never plain text.
- Sections inside a record tab start with `SectionHeader` (title, optional subtitle, actions on the right).
- A record tab with a list (assessments, surveillance & samples, history) is a `RecordTabPanel`: it fills the record body (no card inside the card), one header row, content that scrolls inside, pagination kept at the bottom — the same look as the registry lists.
- Documents tabs, and attachments everywhere, use `DocumentsWorkspace` / `AttachmentField`: the titled section with the shared «Attachments» box and «Add attachment».
- A record's read view is a `record-view-stack`: `SectionHeader`, the context as a `RecordDetailsGrid` sheet, the key figures as a `RecordMetricStrip`, then the record's own list. Dates read dd/mm/yyyy (and HH:MM).
- In forms every control (text, select, date, time, checkbox line) is 40px high and fields in a row line up on one grid (`entry-grid`, equal columns, labels above the control); yes/no flags use `CheckboxField` / `YesNoField`, months `MonthField`.
- Field titles, editable or read-only, use the `lo-field-label` style (Field, ManualDateField, TimeField, SearchableSelect, RecordDetailsGrid apply it).
- Multi-choice fields use `ChoiceChips`, not checkboxes in pills.
- An empty registry shows the RegistryTable empty state under the column headings and hides pagination (`RegistryPagination` renders nothing without rows). Two different empty states (`RegistryEmptyState`): «nothing matches the search / filters» with «Clear filters», and «nothing created yet» with an icon, a line on what the list holds and the create action.
- A nested view inside a record (e.g. an episode inside a tab) shows its path with `Breadcrumbs` instead of a second Back button.
- Status badges, table geometry and row actions must use existing Observer primitives before new CSS is introduced.

## Committee-specific rule
Committees may add governance content (membership history, quorum, minutes, approvals, action follow-up), but all of it must remain inside the Observer patterns above. There is no separate “committee design system”.
