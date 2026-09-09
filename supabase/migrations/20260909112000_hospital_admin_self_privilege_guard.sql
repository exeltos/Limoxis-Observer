-- Prevent an authenticated user from changing the authorization attributes of
-- their own organization membership, even when their role is hospital_admin.
-- Service-role operations and another authorized administrator remain allowed.

create or replace function public.prevent_self_membership_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and old.user_id = auth.uid() then
    if new.role is distinct from old.role
       or new.custom_role_id is distinct from old.custom_role_id then
      raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_self_membership_privilege_change() from public;
grant execute on function public.prevent_self_membership_privilege_change() to authenticated;

drop trigger if exists organization_members_self_privilege_guard on public.organization_members;
create trigger organization_members_self_privilege_guard
before update of role, custom_role_id on public.organization_members
for each row execute function public.prevent_self_membership_privilege_change();

create or replace function public.prevent_self_member_capability_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_membership_id uuid;
  target_user_id uuid;
begin
  target_membership_id := coalesce(new.membership_id, old.membership_id);
  select om.user_id into target_user_id
  from public.organization_members om
  where om.id = target_membership_id;

  if auth.uid() is not null and target_user_id = auth.uid() then
    raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.prevent_self_member_capability_change() from public;
grant execute on function public.prevent_self_member_capability_change() to authenticated;

drop trigger if exists organization_member_capabilities_self_guard on public.organization_member_capabilities;
create trigger organization_member_capabilities_self_guard
before insert or update or delete on public.organization_member_capabilities
for each row execute function public.prevent_self_member_capability_change();
