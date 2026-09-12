-- Committee framework fields define the institutional mandate of a committee.
-- Operational secretariat permissions must not implicitly permit changing that mandate.
-- Archived committees remain immutable even for users with governance capability.

drop policy if exists committees_edit on public.committees;
create policy committees_edit on public.committees
for update to authenticated
using (
  status <> 'archived'
  and public.current_user_has_governance_capability(organization_id,'create_committee')
)
with check (
  status <> 'archived'
  and public.current_user_has_governance_capability(organization_id,'create_committee')
);
