-- Fix management audit trigger: PL/pgSQL NEW/OLD records cannot be referenced
-- through coalesce when the current operation does not provide that record shape.
create or replace function private.audit_management_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_entity text;
  v_actor_role public.app_role;
  v_is_platform_owner boolean := false;
begin
  if tg_table_name = 'master_library_items'
     and tg_op = 'INSERT'
     and coalesce(new.metadata->>'system','false') = 'true'
     and pg_trigger_depth() > 1 then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(p.is_platform_owner,false)
    into v_is_platform_owner
  from public.profiles p
  where p.id = (select auth.uid());

  if tg_table_name = 'custom_role_capabilities' then
    if tg_op = 'DELETE' then
      select r.organization_id into v_org
      from public.custom_roles r
      where r.id = old.custom_role_id;
    else
      select r.organization_id into v_org
      from public.custom_roles r
      where r.id = new.custom_role_id;
    end if;
  elsif tg_op = 'DELETE' then
    v_org := old.organization_id;
  else
    v_org := new.organization_id;
  end if;

  if v_org is not null and not v_is_platform_owner and not public.is_org_member(v_org) then
    raise exception 'Organization membership required';
  end if;

  if v_is_platform_owner then
    v_actor_role := 'platform_owner'::public.app_role;
  else
    select om.role into v_actor_role
    from public.organization_members om
    where om.organization_id = v_org
      and om.user_id = (select auth.uid())
      and om.status = 'active'
    order by om.created_at desc
    limit 1;
  end if;

  if tg_op = 'DELETE' then
    v_entity := old.id::text;
  else
    v_entity := new.id::text;
  end if;

  insert into public.system_audit_log(
    organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata
  ) values (
    case when v_is_platform_owner and tg_op = 'DELETE' then null else v_org end,
    (select auth.uid()), v_actor_role, lower(tg_op), tg_table_name, v_entity,
    jsonb_build_object(
      'source','management_center',
      'operation',tg_op,
      'organization_id',v_org
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;
