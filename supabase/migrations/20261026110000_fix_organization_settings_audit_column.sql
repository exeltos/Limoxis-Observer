-- Saving a hospital's profile, screen lock or identity failed with
-- "column action of relation system_audit_log does not exist".
--
-- update_organization_profile, set_organization_idle_lock and
-- set_organization_branding wrote their audit entry to a column named action,
-- but system_audit_log has always called it event_type (202608270001). The
-- functions compile (plpgsql resolves columns when it runs), so the error only
-- showed on save: the Platform Owner's hospital record and the hospital admin's
-- Management screens could not store these settings. Confirmed on the live
-- database. Each function is replaced with its live body, writing event_type;
-- CREATE OR REPLACE keeps their grants.

create or replace function public.update_organization_profile(p_organization_id uuid, p_name text, p_region text default null::text, p_health_region text default null::text, p_city text default null::text, p_country text default 'GR'::text, p_contact_email text default null::text, p_contact_phone text default null::text, p_bed_capacity integer default null::integer)
returns public.organizations
language plpgsql
security definer
set search_path to ''
as $function$
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

  insert into public.system_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','before',to_jsonb(v_before),'after',to_jsonb(v_after)));

  return v_after;
end;
$function$;

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

  insert into public.system_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','field','idle_lock_minutes','before',v_before,'after',p_minutes));

  return p_minutes;
end;
$function$;

create or replace function public.set_organization_branding(p_organization_id uuid, p_branding jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_branding jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;
  if p_branding is null or jsonb_typeof(p_branding) <> 'object' then raise exception 'INVALID_BRANDING'; end if;
  if octet_length(p_branding::text) > 400000 then raise exception 'BRANDING_TOO_LARGE'; end if;
  if coalesce(p_branding->>'logo','') <> '' and left(p_branding->>'logo', 11) <> 'data:image/' then raise exception 'INVALID_LOGO'; end if;

  v_branding := jsonb_build_object('logo', coalesce(p_branding->>'logo',''), 'reportHeader', left(coalesce(p_branding->>'reportHeader',''), 200));

  update public.organizations set branding=v_branding, updated_at=now() where id=p_organization_id;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  insert into public.system_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','field','branding','logo',(v_branding->>'logo')<>'','reportHeader',v_branding->>'reportHeader'));

  return v_branding;
end;
$function$;
