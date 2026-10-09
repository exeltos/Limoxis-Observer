-- Demo lifecycle and organization offboarding (phase 5), as approved by the
-- platform owner:
--   * Demos are extended with one action and expire by themselves; expired
--     Demos are deleted automatically after N days (platform setting, default
--     14, 0 = never), never while an "I want the application" request is new.
--   * A Demo becomes a customer in one transaction that always clears its
--     synthetic data first.
--   * A real hospital is deleted after a grace period (default 30 days) and
--     only with a recent export, unless the export is waived with a reason.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- 1. Settings and columns -------------------------------------------------------
alter table public.platform_settings add column if not exists demo_auto_purge_after_days integer not null default 14
  check (demo_auto_purge_after_days between 0 and 365);
alter table public.platform_settings add column if not exists organization_deletion_grace_days integer not null default 30
  check (organization_deletion_grace_days between 1 and 365);

alter table public.platform_demo_entitlements add column if not exists converted_at timestamptz;

alter table public.organizations add column if not exists deletion_scheduled_at timestamptz;
alter table public.organizations add column if not exists deletion_requested_at timestamptz;
alter table public.organizations add column if not exists deletion_requested_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists deletion_reason text check (deletion_reason is null or char_length(deletion_reason) <= 1000);
alter table public.organizations add column if not exists deletion_export_waived_reason text check (deletion_export_waived_reason is null or char_length(deletion_export_waived_reason) <= 1000);
create index if not exists organizations_deletion_requested_by_idx on public.organizations(deletion_requested_by);

-- An organization scheduled for deletion is closed as well (phase 2 holds).
create or replace function private.org_access_open(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active' and o.deletion_scheduled_at is null
      and (not o.is_demo or not exists (
        select 1 from public.platform_demo_entitlements e
        where e.organization_id = o.id
          and not (e.status = 'active' and current_date between e.valid_from and e.valid_until)))
  );
$function$;

-- 2. Demo: extend, expire, purge candidates ---------------------------------------
create or replace function public.platform_extend_demo(p_entitlement_id uuid, p_valid_until date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := (select e.organization_id from public.platform_demo_entitlements e where e.id = p_entitlement_id);
  v_previous date := (select e.valid_until from public.platform_demo_entitlements e where e.id = p_entitlement_id);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if v_org is null then
    raise exception 'Demo not found' using errcode = 'P0002';
  end if;
  if p_valid_until is null or p_valid_until < current_date then
    raise exception 'The new end date must be today or later' using errcode = '22023';
  end if;
  update public.platform_demo_entitlements e
     set valid_until = p_valid_until,
         valid_from = least(e.valid_from, current_date),
         status = case when e.status in ('active', 'expired') then 'active' else e.status end,
         updated_at = now()
   where e.id = p_entitlement_id and e.status <> 'revoked';
  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (v_org, auth.uid(), 'platform_owner', 'platform.demo.extended', 'platform_demo_entitlement', p_entitlement_id::text,
    jsonb_build_object('previous_valid_until', v_previous, 'valid_until', p_valid_until));
  return jsonb_build_object('validUntil', p_valid_until);
end;
$function$;

revoke all on function public.platform_extend_demo(uuid, date) from public, anon;
grant execute on function public.platform_extend_demo(uuid, date) to authenticated;

-- Nightly: active Demos past their end date become expired (access is already
-- closed by date; this keeps the registry and the purge rule in step).
create or replace function private.platform_demo_housekeeping()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := (select count(*) from public.platform_demo_entitlements e where e.status = 'active' and e.valid_until < current_date);
begin
  update public.platform_demo_entitlements e set status = 'expired', updated_at = now()
   where e.status = 'active' and e.valid_until < current_date;
  return v_count;
end;
$function$;
revoke all on function private.platform_demo_housekeeping() from public, anon, authenticated;

-- Demos due for automatic deletion: expired more than N days ago, no new
-- "I want the application" request, never the Owner's own Demo.
create or replace function public.platform_demo_purge_candidates()
returns table(organization_id uuid, code text, name text, valid_until date)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.id, o.code, o.name, e.valid_until
  from public.platform_demo_entitlements e
  join public.organizations o on o.id = e.organization_id and o.is_demo
  cross join (select s.demo_auto_purge_after_days n from public.platform_settings s where s.id = 'global') st
  where (select public.current_user_is_platform_owner())
    and st.n > 0
    and e.status in ('active', 'expired', 'paused')
    and e.valid_until < current_date - st.n
    and o.code <> 'DEMO-OWNER'
    and not exists (select 1 from public.demo_application_requests r where r.demo_organization_id = o.id and r.status = 'new')
  order by e.valid_until
  limit 20;
$function$;
revoke all on function public.platform_demo_purge_candidates() from public, anon;
grant execute on function public.platform_demo_purge_candidates() to authenticated;

-- 3. Demo → customer ------------------------------------------------------------------
create or replace function public.platform_convert_demo_tx(p_organization_id uuid, p_name text, p_code text, p_details jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := upper(nullif(btrim(coalesce(p_code, '')), ''));
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
  v_old_code text := (select o.code from public.organizations o where o.id = p_organization_id and o.is_demo);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if v_old_code is null then
    raise exception 'Only a Demo organization can be converted' using errcode = '42501';
  end if;
  if v_name is null or v_code is null then
    raise exception 'Name and code are required' using errcode = '22023';
  end if;
  if exists (select 1 from public.organizations o where upper(o.code) = v_code and o.id <> p_organization_id) then
    raise exception 'Organization code already in use' using errcode = '23505';
  end if;

  -- The synthetic clinical data never reaches a real hospital.
  perform private.demo_wipe_data(p_organization_id);

  update public.organizations o set
    is_demo = false, status = 'active', paused_at = null, name = v_name, code = v_code,
    type = coalesce(nullif(v_details->>'type', '')::public.organization_type, o.type),
    region = nullif(v_details->>'region', ''), health_region = nullif(v_details->>'healthRegion', ''),
    city = nullif(v_details->>'city', ''), country = coalesce(nullif(v_details->>'country', ''), o.country, 'Ελλάδα'),
    contact_email = nullif(lower(btrim(coalesce(v_details->>'contactEmail', ''))), ''),
    contact_phone = nullif(v_details->>'contactPhone', ''),
    bed_capacity = nullif(v_details->>'bedCapacity', '')::integer,
    updated_at = now()
  where o.id = p_organization_id;

  -- After the organization is real, so the access rules keep its members in.
  update public.platform_demo_entitlements e set status = 'revoked', converted_at = now(), updated_at = now()
   where e.organization_id = p_organization_id;
  update public.profiles p set is_demo = false, demo_entitlement_id = null
   where p.id in (select om.user_id from public.organization_members om where om.organization_id = p_organization_id);
  perform private.apply_org_access(p_organization_id);

  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'platform_owner', 'platform.demo.converted', 'organization', p_organization_id::text,
    jsonb_build_object('previous_code', v_old_code, 'code', v_code, 'name', v_name));
  return jsonb_build_object('organizationId', p_organization_id, 'code', v_code, 'name', v_name);
end;
$function$;

revoke all on function public.platform_convert_demo_tx(uuid, text, text, jsonb) from public, anon;
grant execute on function public.platform_convert_demo_tx(uuid, text, text, jsonb) to authenticated;

-- 4. Organization export ----------------------------------------------------------------
-- The export record points to its organization with source_organization_id
-- (not organization_id), so it outlives the organization's deletion.
create table if not exists public.platform_organization_exports (
  id uuid primary key default gen_random_uuid(),
  source_organization_id uuid references public.organizations(id) on delete set null,
  organization_name text not null,
  organization_code text,
  storage_path text not null,
  file_size bigint,
  tables_count integer,
  rows_count bigint,
  files_count integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists platform_organization_exports_org_idx on public.platform_organization_exports(source_organization_id, created_at desc);
create index if not exists platform_organization_exports_created_by_idx on public.platform_organization_exports(created_by);
alter table public.platform_organization_exports enable row level security;
create policy platform_organization_exports_owner_read on public.platform_organization_exports for select to authenticated
  using ((select public.current_user_is_platform_owner()));
revoke all on public.platform_organization_exports from anon;
grant select on public.platform_organization_exports to authenticated;

insert into storage.buckets(id, name, public) values ('organization-exports', 'organization-exports', false)
on conflict (id) do nothing;

-- Used by the platform-export-organization Edge Function (service role).
create or replace function public.platform_organization_export_manifest(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'tables', (select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
               from private.organization_data_tables() t join pg_catalog.pg_class c on c.oid = t),
    'files', (select coalesce(jsonb_agg(jsonb_build_object('bucket', so.bucket_id, 'name', so.name) order by so.bucket_id, so.name), '[]'::jsonb)
              from storage.objects so
              where so.bucket_id in ('attachments', 'laboratory-attachments') and so.name like p_organization_id::text || '/%'));
$function$;
revoke all on function public.platform_organization_export_manifest(uuid) from public, anon, authenticated;
grant execute on function public.platform_organization_export_manifest(uuid) to service_role;

-- 5. Scheduled deletion of a real organization --------------------------------------
create or replace function public.platform_schedule_organization_deletion(p_organization_id uuid, p_reason text, p_export_waived_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_waived text := nullif(btrim(coalesce(p_export_waived_reason, '')), '');
  v_grace integer := coalesce((select s.organization_deletion_grace_days from public.platform_settings s where s.id = 'global'), 30);
  v_at timestamptz := date_trunc('day', now()) + make_interval(days => coalesce((select s.organization_deletion_grace_days from public.platform_settings s where s.id = 'global'), 30));
  v_export uuid := (select x.id from public.platform_organization_exports x
    where x.source_organization_id = p_organization_id and x.created_at > now() - interval '30 days' order by x.created_at desc limit 1);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and not o.is_demo) then
    raise exception 'Only a real organization is scheduled for deletion' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if v_export is null and v_waived is null then
    raise exception 'An export from the last 30 days is required' using errcode = '55000';
  end if;
  update public.organizations o set
    deletion_scheduled_at = v_at, deletion_requested_at = now(), deletion_requested_by = auth.uid(),
    deletion_reason = left(v_reason, 1000), deletion_export_waived_reason = case when v_export is null then left(v_waived, 1000) end,
    status = 'suspended', paused_at = coalesce(o.paused_at, now()), updated_at = now()
  where o.id = p_organization_id;
  perform private.apply_org_access(p_organization_id);
  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'platform_owner', 'platform.organization.deletion_scheduled', 'organization', p_organization_id::text,
    jsonb_build_object('deletion_scheduled_at', v_at, 'grace_days', v_grace, 'reason', v_reason, 'export_id', v_export, 'export_waived_reason', case when v_export is null then v_waived end));
  return jsonb_build_object('deletionScheduledAt', v_at, 'exportId', v_export);
end;
$function$;

create or replace function public.platform_cancel_organization_deletion(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.deletion_scheduled_at is not null) then
    raise exception 'No deletion is scheduled for this organization' using errcode = '22023';
  end if;
  update public.organizations o set
    deletion_scheduled_at = null, deletion_requested_at = null, deletion_requested_by = null, deletion_reason = null,
    deletion_export_waived_reason = null, status = 'active', paused_at = null, updated_at = now()
  where o.id = p_organization_id;
  perform private.apply_org_access(p_organization_id);
  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'platform_owner', 'platform.organization.deletion_cancelled', 'organization', p_organization_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.platform_schedule_organization_deletion(uuid, text, text) from public, anon;
grant execute on function public.platform_schedule_organization_deletion(uuid, text, text) to authenticated;
revoke all on function public.platform_cancel_organization_deletion(uuid) from public, anon;
grant execute on function public.platform_cancel_organization_deletion(uuid) to authenticated;

-- 6. Nightly job ------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'limoxis-demo-housekeeping';
    perform cron.schedule('limoxis-demo-housekeeping', '17 2 * * *', 'select private.platform_demo_housekeeping(); select private.apply_all_org_access();');
  end if;
end
$cron$;
