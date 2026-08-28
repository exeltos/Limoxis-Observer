# v0.26.12 — Training + Employees

## Training create consistency
- New Training remains a full record route, but the form is now one shared `record-section`, matching the established Quality/new-record pattern.
- Removed the two-card visual split from the create screen.
- Completion/competence is a compact subsection inside the same form rather than a second card.
- Save/Cancel uses the shared inline footer.

## Training materials
- Added compact View action before Edit/Delete.
- Uploaded local files receive a session object URL so they can be opened immediately in View.
- URL materials open their URL.
- The existing upload + URL/reference choice remains.
- Durable binary storage still belongs to Supabase Storage in the backend phase.

## Employees
- Fixed the New Employee action: it now opens `/employees/new`.
- Added a full record-style employee creation screen.
- Department and professional category use the central management libraries.
- Demo/local employees persist in a shared employee store and appear in Employees plus Training staff selectors.
- New employee opens its real employee detail page after save.
