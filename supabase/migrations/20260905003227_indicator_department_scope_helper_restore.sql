create or replace function private.indicator_requires_department_scope(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_user_is_platform_owner() then false
    else public.current_user_has_org_role(
      p_organization_id,
      array['link_nurse','department_manager']::public.app_role[]
    )
  end;
$$;

revoke all on function private.indicator_requires_department_scope(uuid) from public, anon, authenticated;
