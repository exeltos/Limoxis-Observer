create or replace function public.update_organization_profile(
  p_organization_id uuid,
  p_name text,
  p_region text default null,
  p_health_region text default null,
  p_city text default null,
  p_country text default 'GR',
  p_contact_email text default null,
  p_contact_phone text default null,
  p_bed_capacity integer default null
) returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.organizations;
  v_after public.organizations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'ORGANIZATION_NAME_REQUIRED'; end if;
  if p_bed_capacity is not null and p_bed_capacity < 0 then raise exception 'INVALID_BED_CAPACITY'; end if;

  select * into v_before from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set
    name=btrim(p_name),
    region=nullif(btrim(coalesce(p_region,'')),''),
    health_region=nullif(btrim(coalesce(p_health_region,'')),''),
    city=nullif(btrim(coalesce(p_city,'')),''),
    country=coalesce(nullif(upper(btrim(coalesce(p_country,''))),''),'GR'),
    contact_email=nullif(lower(btrim(coalesce(p_contact_email,''))),''),
    contact_phone=nullif(btrim(coalesce(p_contact_phone,'')),''),
    bed_capacity=p_bed_capacity,
    updated_at=now()
  where id=p_organization_id
  returning * into v_after;

  insert into public.system_audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','before',to_jsonb(v_before),'after',to_jsonb(v_after)));

  return v_after;
end;
$$;
revoke all on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) from public, anon;
grant execute on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) to authenticated;
