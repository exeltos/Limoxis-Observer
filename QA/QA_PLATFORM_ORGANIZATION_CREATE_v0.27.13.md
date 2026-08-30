# QA — Platform organization creation v0.27.13

- Platform Owner → Organizations keeps the common Observer drill-down layout.
- “New organization” opens the canonical `ObserverDialog` with shared form sections and entry-grid fields.
- Required organization fields: name, unique code, type, initial status.
- Initial Hospital Admin is required and created through the existing `create-organization-user` Edge Function.
- Creation sequence: organization → Hospital Admin → refresh platform organizations.
- If Hospital Admin creation fails, the newly-created organization is rolled back to avoid an orphan tenant.
- Temporary username/password are shown once in a confirmation dialog with copy actions.
- Save uses canonical `SaveButton` loading/disabled state; Cancel uses canonical secondary `Button`.
- EL/EN labels are included for all new visible UI.
- Platform Owner stays outside hospital membership and can enter the new organization through the organization list.
