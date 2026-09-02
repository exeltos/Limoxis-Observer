create schema if not exists private;

revoke all on table public.master_library_items from anon;
revoke all on table public.departments from anon;
revoke all on table public.custom_roles from anon;
revoke all on table public.custom_role_capabilities from anon;
revoke all on table public.external_reference_versions from anon;

grant select, insert, update, delete on table public.master_library_items to authenticated;
grant select, insert, update, delete on table public.departments to authenticated;
grant select, insert, update, delete on table public.custom_roles to authenticated;
grant select, insert, update, delete on table public.custom_role_capabilities to authenticated;
grant select, insert, update, delete on table public.external_reference_versions to authenticated;

create or replace function private.audit_management_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_entity text;
  v_actor_role public.app_role;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if tg_table_name = 'custom_role_capabilities' then
    select r.organization_id into v_org from public.custom_roles r where r.id = coalesce(new.custom_role_id, old.custom_role_id);
  else
    v_org := coalesce(new.organization_id, old.organization_id);
  end if;
  if v_org is not null and not public.is_org_member(v_org) then raise exception 'Organization membership required'; end if;
  select om.role into v_actor_role from public.organization_members om
    where om.organization_id = v_org and om.user_id = (select auth.uid()) and om.status = 'active'
    order by om.created_at desc limit 1;
  v_entity := coalesce(new.id, old.id)::text;
  insert into public.system_audit_log(organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata)
  values (v_org,(select auth.uid()),v_actor_role,lower(tg_op),tg_table_name,v_entity,jsonb_build_object('source','management_center','operation',tg_op));
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_management_change() from public;
revoke all on function private.audit_management_change() from anon;
revoke all on function private.audit_management_change() from authenticated;

create or replace trigger trg_audit_master_library_items after insert or update or delete on public.master_library_items for each row execute function private.audit_management_change();
create or replace trigger trg_audit_departments after insert or update or delete on public.departments for each row execute function private.audit_management_change();
create or replace trigger trg_audit_custom_roles after insert or update or delete on public.custom_roles for each row execute function private.audit_management_change();
create or replace trigger trg_audit_custom_role_capabilities after insert or update or delete on public.custom_role_capabilities for each row execute function private.audit_management_change();
create or replace trigger trg_audit_external_reference_versions after insert or update or delete on public.external_reference_versions for each row execute function private.audit_management_change();
