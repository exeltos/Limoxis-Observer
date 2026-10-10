-- Screen guides (the short manual excerpt that opens the first time a user
-- visits a screen) per hospital and per user.
--
-- Until now the guides ran only in Demo organizations and every Demo user saw
-- them. Now:
--   organizations.screen_guides_enabled  null = default (on for a Demo, off for
--                                        a hospital), true = on, false = off;
--   organization_members.screen_guides   null = as the hospital, true / false
--                                        = this user in this hospital.
-- The effective value is screen_guides ?? screen_guides_enabled ?? is_demo.
-- A user can still turn the guides off for themselves from a guide
-- (user_screen_guides '*'), and back on from Help.
--
-- Both values are read with the membership and change only through the RPCs
-- below, for the platform owner or the organization's admin, with an audit
-- log entry, like set_organization_idle_lock.

alter table public.organizations
  add column if not exists screen_guides_enabled boolean;

alter table public.organization_members
  add column if not exists screen_guides boolean;

create or replace function public.set_organization_screen_guides(p_organization_id uuid, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_before boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;

  select screen_guides_enabled into v_before from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set screen_guides_enabled = p_enabled, updated_at = now() where id = p_organization_id;

  insert into public.system_audit_log(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'update', 'organization', p_organization_id,
    jsonb_build_object('source', 'management_center', 'field', 'screen_guides_enabled', 'before', v_before, 'after', p_enabled));

  return p_enabled;
end;
$function$;

revoke all on function public.set_organization_screen_guides(uuid, boolean) from public, anon;
grant execute on function public.set_organization_screen_guides(uuid, boolean) to authenticated;

create or replace function public.set_member_screen_guides(p_organization_id uuid, p_user_id uuid, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_member uuid;
  v_before boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;

  select id, screen_guides into v_member, v_before
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id
  for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  update public.organization_members set screen_guides = p_enabled where id = v_member;

  insert into public.system_audit_log(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'update', 'organization_member', v_member,
    jsonb_build_object('source', 'management_center', 'field', 'screen_guides', 'user_id', p_user_id, 'before', v_before, 'after', p_enabled));

  return p_enabled;
end;
$function$;

revoke all on function public.set_member_screen_guides(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_member_screen_guides(uuid, uuid, boolean) to authenticated;
