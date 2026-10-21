-- Management › Users read organization_members and profiles directly, but their RLS
-- (organization_members_read_scoped, profiles_read_self_or_owner) shows a Hospital
-- Admin only its own row: the list held one user. This RPC returns the members of one
-- organization with their profile, for that organization's admin or the Platform Owner.

create or replace function public.organization_users_list(p_organization_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role text,
  status text,
  screen_guides boolean,
  full_name text,
  username text,
  contact_email text,
  phone text,
  job_title text,
  created_at timestamptz
)
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
    select m.id, m.user_id, m.role::text, m.status::text, m.screen_guides,
           p.full_name, p.username, p.contact_email, p.phone, p.job_title, m.created_at
      from public.organization_members m
      left join public.profiles p on p.id = m.user_id
     where m.organization_id = p_organization_id
     order by m.created_at;
end;
$function$;

revoke all on function public.organization_users_list(uuid) from public, anon;
grant execute on function public.organization_users_list(uuid) to authenticated;
