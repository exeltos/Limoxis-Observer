# My Department navigation visibility — v0.24.5

- `Το τμήμα μου` is now a role-specific workspace, not a generic capability-driven Admin item.
- It is shown in the sidebar only for:
  - Department Manager
  - Department User
- Hospital Admin keeps full access to all hospital modules and departments, but does not see `Το τμήμα μου`.
- Platform Owner does not see it.
- Added the missing top-level i18n label:
  - EL: `Το προφίλ μου`
  - EN: `My profile`
- This corrects the raw `myProfile` key previously visible in the sidebar.
