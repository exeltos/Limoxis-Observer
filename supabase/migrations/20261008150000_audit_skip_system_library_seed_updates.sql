-- Creating an organization from an Edge Function (new Demo, new hospital)
-- failed with "Authentication required".
--
-- The AFTER INSERT trigger on organizations seeds the system libraries: it
-- inserts the baseline items and then copies the global items with
-- ON CONFLICT (organization_id, library_key, name_el) DO UPDATE. Items present
-- in both sets turn the second statement into UPDATEs. audit_management_change
-- skipped nested INSERTs of system rows but not these UPDATEs, so it required a
-- signed-in user, and the service-role call has none.
--
-- Same function as 20260905103113, with the system-row skip extended to UPDATE.

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
  v_new jsonb;
  v_old jsonb;
  v_row jsonb;
  v_metadata jsonb;
begin
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  v_row := case when tg_op = 'DELETE' then v_old else v_new end;

  -- System library rows written by the organization-create seed (a nested
  -- trigger, no signed-in user when an Edge Function creates the organization)
  -- are not management changes. The seed inserts them and then re-links the
  -- same rows (ON CONFLICT DO UPDATE), so both operations are skipped.
  if tg_table_name = 'master_library_items'
     and tg_op in ('INSERT','UPDATE')
     and coalesce(v_new->'metadata'->>'system','false') = 'true'
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
    where r.id = (v_row->>'custom_role_id')::uuid;
  else
    v_org := nullif(v_row->>'organization_id','')::uuid;
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

  v_entity := v_row->>'id';
  v_metadata := jsonb_build_object(
    'source','management_center',
    'operation',tg_op,
    'organization_id',v_org
  );

  if tg_table_name = 'controlled_documents' then
    v_metadata := v_metadata || jsonb_build_object(
      'code',coalesce(v_new->>'code',v_old->>'code'),
      'version',coalesce(v_new->>'version',v_old->>'version'),
      'old_status',case when tg_op='INSERT' then null else v_old->>'status' end,
      'new_status',case when tg_op='DELETE' then null else v_new->>'status' end
    );
  end if;

  insert into public.system_audit_log(
    organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
  ) values (
    case when v_is_platform_owner and tg_op = 'DELETE' then null else v_org end,
    (select auth.uid()),v_actor_role,lower(tg_op),tg_table_name,v_entity,v_metadata
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;
