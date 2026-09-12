drop policy if exists indicator_snapshots_read on public.indicator_snapshots;
drop policy if exists indicator_snapshots_write on public.indicator_snapshots;
drop policy if exists indicator_snapshots_update on public.indicator_snapshots;

create policy indicator_snapshots_read
on public.indicator_snapshots
for select
to authenticated
using (
  current_user_is_platform_owner()
  or (
    current_user_has_capability(organization_id, 'view_indicators')
    and (
      not exists (
        select 1
        from public.organization_members om
        join public.organization_member_scopes oms on oms.membership_id = om.id
        where om.organization_id = indicator_snapshots.organization_id
          and om.user_id = (select auth.uid())
          and om.status = 'active'
      )
      or (
        department_id is not null
        and current_user_has_department_scope(organization_id, department_id)
      )
    )
  )
);

create policy indicator_snapshots_write
on public.indicator_snapshots
for insert
to authenticated
with check (
  current_user_is_platform_owner()
  or (
    current_user_has_capability(organization_id, 'manage_indicators')
    and (
      not exists (
        select 1
        from public.organization_members om
        join public.organization_member_scopes oms on oms.membership_id = om.id
        where om.organization_id = indicator_snapshots.organization_id
          and om.user_id = (select auth.uid())
          and om.status = 'active'
      )
      or (
        department_id is not null
        and current_user_has_department_scope(organization_id, department_id)
      )
    )
  )
);

create policy indicator_snapshots_update
on public.indicator_snapshots
for update
to authenticated
using (
  current_user_is_platform_owner()
  or (
    current_user_has_capability(organization_id, 'manage_indicators')
    and (
      not exists (
        select 1
        from public.organization_members om
        join public.organization_member_scopes oms on oms.membership_id = om.id
        where om.organization_id = indicator_snapshots.organization_id
          and om.user_id = (select auth.uid())
          and om.status = 'active'
      )
      or (
        department_id is not null
        and current_user_has_department_scope(organization_id, department_id)
      )
    )
  )
)
with check (
  current_user_is_platform_owner()
  or (
    current_user_has_capability(organization_id, 'manage_indicators')
    and (
      not exists (
        select 1
        from public.organization_members om
        join public.organization_member_scopes oms on oms.membership_id = om.id
        where om.organization_id = indicator_snapshots.organization_id
          and om.user_id = (select auth.uid())
          and om.status = 'active'
      )
      or (
        department_id is not null
        and current_user_has_department_scope(organization_id, department_id)
      )
    )
  )
);