# v0.26.30
- Indicator card actions now use the same compact Pencil / Trash icon pattern used elsewhere.
- Authorized indicator managers can Edit/Delete every indicator shown in the hospital registry, not only CUSTOM-* indicators.
- Editing a built-in definition creates a hospital-level override; source code definition remains intact.
- Deleting a built-in definition removes it from the hospital indicator registry via a local deleted-ID configuration; source records are never deleted.
- Custom indicators continue to edit/delete normally.
