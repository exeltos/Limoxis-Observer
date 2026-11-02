-- Who recorded an entry: the names of the people behind a list of user ids, for the
-- clinical history («recorded by …») instead of showing an id. Only the full name,
-- only for the members of that organization (and the Platform Owner, who also works
-- in it), and only to an active member of the same organization or the Platform Owner.
create or replace function public.organization_member_names(p_organization_id uuid, p_user_ids uuid[])
returns table(user_id uuid, full_name text)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any (p_user_ids[1:200])
    and (
      public.current_user_is_platform_owner()
      or exists (
        select 1 from public.organization_members me
        where me.organization_id = p_organization_id and me.user_id = auth.uid() and me.status = 'active'
      )
    )
    and (
      p.is_platform_owner
      or exists (
        select 1 from public.organization_members m
        where m.organization_id = p_organization_id and m.user_id = p.id
      )
    );
$function$;

revoke all on function public.organization_member_names(uuid, uuid[]) from public, anon;
grant execute on function public.organization_member_names(uuid, uuid[]) to authenticated;
