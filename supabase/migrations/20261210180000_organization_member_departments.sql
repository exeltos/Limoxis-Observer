-- Management › Users: the department of each member. The roles of a department
-- (department manager, department user, link nurse) see only their department
-- (organization_member_scopes); the Hospital Admin sets it when creating the account or
-- changing the role, and sees it in the list. Scope RLS shows a user only its own rows,
-- so this RPC returns them for the organization's admin or the Platform Owner.

create or replace function public.organization_member_departments(p_organization_id uuid)
returns table (membership_id uuid, department_id uuid, department_name text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then
    raise exception 'ORG_ADMIN_REQUIRED';
  end if;
  return query
    select s.membership_id, s.department_id, d.name
      from public.organization_member_scopes s
      join public.organization_members m on m.id = s.membership_id
      left join public.departments d on d.id = s.department_id
     where m.organization_id = p_organization_id;
end;
$function$;

revoke all on function public.organization_member_departments(uuid) from public, anon;
grant execute on function public.organization_member_departments(uuid) to authenticated;
