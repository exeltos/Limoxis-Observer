-- The LIRA button on every page (owner, 8/11/2026: «κουμπί να κρύβω εντελώς το κουμπί LIRA»): per hospital, set in
-- Κέντρο Διαχείρισης › LIRA & AI by the platform owner or the hospital's admin, with an audit entry, like
-- set_organization_screen_guides. null / true = shown, false = hidden for every user of the hospital.
alter table public.organizations
  add column if not exists lira_launcher_enabled boolean;

create or replace function public.set_organization_lira_launcher(p_organization_id uuid, p_enabled boolean)
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

  select lira_launcher_enabled into v_before from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set lira_launcher_enabled = p_enabled, updated_at = now() where id = p_organization_id;

  insert into public.system_audit_log(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'update', 'organization', p_organization_id,
    jsonb_build_object('source', 'management_center', 'field', 'lira_launcher_enabled', 'before', v_before, 'after', p_enabled));

  return p_enabled;
end;
$function$;

revoke all on function public.set_organization_lira_launcher(uuid, boolean) from public, anon;
grant execute on function public.set_organization_lira_launcher(uuid, boolean) to authenticated;
