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
    select r.organization_id into v_org
    from public.custom_roles r
    where r.id = coalesce(new.custom_role_id, old.custom_role_id);
  else
    v_org := coalesce(new.organization_id, old.organization_id);
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

  v_entity := coalesce(new.id, old.id)::text;

  insert into public.system_audit_log(
    organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
  ) values (
    v_org,(select auth.uid()),v_actor_role,lower(tg_op),tg_table_name,v_entity,
    jsonb_build_object('source','management_center','operation',tg_op)
  );

  return coalesce(new, old);
end;
$function$;

create or replace function public.platform_purge_organization_tx(
  p_organization_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_children integer := 0;
  v_user_ids uuid[] := array[]::uuid[];
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor and coalesce(p.is_platform_owner,false) = true
  ) then
    raise exception 'Platform Owner access required';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'Organization not found';
  end if;

  if upper(trim(coalesce(p_confirmation,''))) <> upper(trim(v_org.code)) then
    raise exception 'Confirmation code mismatch';
  end if;

  select count(*) into v_children
  from public.organizations
  where parent_id = p_organization_id;

  if v_children > 0 then
    raise exception 'Organization has child organizations';
  end if;

  select coalesce(array_agg(distinct om.user_id) filter (where om.user_id is not null), array[]::uuid[])
    into v_user_ids
  from public.organization_members om
  where om.organization_id = p_organization_id;

  delete from public.organizations where id = p_organization_id;

  insert into public.system_audit_log(
    actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
  ) values (
    v_actor,'platform_owner'::public.app_role,'platform.organization.purged','organization',p_organization_id,
    jsonb_build_object('organization_name',v_org.name,'organization_code',v_org.code,'is_demo',v_org.is_demo)
  );

  return jsonb_build_object(
    'ok',true,
    'organizationId',p_organization_id,
    'organizationCode',v_org.code,
    'isDemo',v_org.is_demo,
    'userIds',to_jsonb(v_user_ids)
  );
end;
$function$;

revoke all on function public.platform_purge_organization_tx(uuid,text) from public;
grant execute on function public.platform_purge_organization_tx(uuid,text) to authenticated;
