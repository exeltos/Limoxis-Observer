-- Screen lock after inactivity, per organization.
--
-- Shared ward computers and tablets: after idle_lock_minutes without activity
-- the app covers the screen and the same user unlocks with their password
-- (anyone else signs in as themselves). 0 turns the lock off. The value is
-- read with the membership's organization; only organization admins (or the
-- platform owner) change it, through set_organization_idle_lock, which writes
-- the audit log like update_organization_profile.

alter table public.organizations
  add column if not exists idle_lock_minutes integer not null default 15
  check (idle_lock_minutes between 0 and 240);

create or replace function public.set_organization_idle_lock(p_organization_id uuid, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_before integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 240 then raise exception 'INVALID_IDLE_LOCK_MINUTES'; end if;

  select idle_lock_minutes into v_before from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set idle_lock_minutes=p_minutes, updated_at=now() where id=p_organization_id;

  insert into public.system_audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','field','idle_lock_minutes','before',v_before,'after',p_minutes));

  return p_minutes;
end;
$function$;

revoke all on function public.set_organization_idle_lock(uuid, integer) from public, anon;
grant execute on function public.set_organization_idle_lock(uuid, integer) to authenticated;
