-- Hospital identity: logo and report header line, per organization.
--
-- branding = { logo: 'data:image/...' (scaled to ≤480px, ≤300 KB), reportHeader:
-- text }. Shown in the top bar, at the top of every PDF and on training
-- certificates. Read with the membership's organization; changed only by
-- organization admins (or the platform owner) through set_organization_branding,
-- which checks the size and writes the audit log.

alter table public.organizations
  add column if not exists branding jsonb not null default '{}'::jsonb;

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

  insert into public.system_audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','field','branding','logo',(v_branding->>'logo')<>'','reportHeader',v_branding->>'reportHeader'));

  return v_branding;
end;
$function$;

revoke all on function public.set_organization_branding(uuid, jsonb) from public, anon;
grant execute on function public.set_organization_branding(uuid, jsonb) to authenticated;
