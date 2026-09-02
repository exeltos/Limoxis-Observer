revoke all on table public.custom_roles from anon;
revoke all on table public.custom_role_capabilities from anon;
grant select, insert, update, delete on table public.custom_roles to authenticated;
grant select, insert, update, delete on table public.custom_role_capabilities to authenticated;

drop policy if exists custom_roles_admin on public.custom_roles;
drop policy if exists custom_roles_read on public.custom_roles;
create policy custom_roles_read on public.custom_roles for select to authenticated using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
create policy custom_roles_admin on public.custom_roles for all to authenticated using (public.is_org_admin(organization_id) or public.current_user_is_platform_owner()) with check (public.is_org_admin(organization_id) or public.current_user_is_platform_owner());

drop policy if exists custom_role_caps_admin on public.custom_role_capabilities;
drop policy if exists custom_role_caps_read on public.custom_role_capabilities;
create policy custom_role_caps_read on public.custom_role_capabilities for select to authenticated using (exists (select 1 from public.custom_roles r where r.id=custom_role_id and (public.is_org_member(r.organization_id) or public.current_user_is_platform_owner())));
create policy custom_role_caps_admin on public.custom_role_capabilities for all to authenticated using (exists (select 1 from public.custom_roles r where r.id=custom_role_id and (public.is_org_admin(r.organization_id) or public.current_user_is_platform_owner()))) with check (exists (select 1 from public.custom_roles r where r.id=custom_role_id and (public.is_org_admin(r.organization_id) or public.current_user_is_platform_owner())));

create or replace function public.save_custom_role(
  p_organization_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text default null,
  p_capabilities text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.custom_roles%rowtype;
  v_name text := nullif(btrim(p_name), '');
  v_capabilities text[];
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not (public.is_org_admin(p_organization_id) or public.current_user_is_platform_owner()) then
    raise exception 'Not authorized to manage roles for this organization';
  end if;
  if v_name is null then
    raise exception 'Role name is required';
  end if;

  select coalesce(array_agg(distinct capability order by capability), '{}'::text[])
    into v_capabilities
  from unnest(coalesce(p_capabilities, '{}'::text[])) as capability
  where nullif(btrim(capability), '') is not null;

  if coalesce(cardinality(v_capabilities),0)=0 then
    raise exception 'At least one capability is required';
  end if;

  if p_role_id is null then
    insert into public.custom_roles(organization_id,name,description,is_active,created_by,updated_at)
    values(p_organization_id,v_name,nullif(btrim(p_description),''),true,(select auth.uid()),now())
    returning * into v_role;
  else
    update public.custom_roles
       set name=v_name,
           description=nullif(btrim(p_description),''),
           updated_at=now()
     where id=p_role_id
       and organization_id=p_organization_id
       and is_active=true
    returning * into v_role;
    if v_role.id is null then
      raise exception 'Active custom role not found in this organization';
    end if;
    delete from public.custom_role_capabilities where custom_role_id=v_role.id;
  end if;

  insert into public.custom_role_capabilities(custom_role_id,capability)
  select v_role.id, capability from unnest(v_capabilities) as capability;

  return jsonb_build_object(
    'id',v_role.id,
    'name',v_role.name,
    'description',v_role.description,
    'is_active',v_role.is_active,
    'capabilities',to_jsonb(v_capabilities)
  );
end;
$$;

revoke all on function public.save_custom_role(uuid,uuid,text,text,text[]) from public;
revoke all on function public.save_custom_role(uuid,uuid,text,text,text[]) from anon;
grant execute on function public.save_custom_role(uuid,uuid,text,text,text[]) to authenticated;
