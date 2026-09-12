-- Limoxis Observer v0.29.3
-- Append-only runtime diagnostics for Platform Owner operational support.
-- Stores only sanitized operational context; no clinical/business payloads.

create table if not exists public.platform_runtime_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid null,
  role public.app_role null,
  severity text not null check (severity in ('info','success','warning','error','blocked')),
  event_type text not null default 'ui_feedback',
  module text null,
  route text null,
  operation text null,
  user_message text not null,
  diagnostic_code text null,
  app_version text null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint platform_runtime_events_user_message_len check (char_length(user_message) between 1 and 500),
  constraint platform_runtime_events_route_len check (route is null or char_length(route) <= 240),
  constraint platform_runtime_events_module_len check (module is null or char_length(module) <= 80),
  constraint platform_runtime_events_operation_len check (operation is null or char_length(operation) <= 80),
  constraint platform_runtime_events_code_len check (diagnostic_code is null or char_length(diagnostic_code) <= 120)
);

create index if not exists platform_runtime_events_org_time_idx
  on public.platform_runtime_events (organization_id, occurred_at desc);
create index if not exists platform_runtime_events_severity_time_idx
  on public.platform_runtime_events (severity, occurred_at desc);

alter table public.platform_runtime_events enable row level security;

drop policy if exists platform_runtime_events_owner_read on public.platform_runtime_events;
create policy platform_runtime_events_owner_read
on public.platform_runtime_events
for select
to authenticated
using (public.current_user_is_platform_owner());

-- No direct client insert/update/delete policies. Events are written only through
-- a narrow RPC that derives actor + role from the authenticated session.
revoke all on public.platform_runtime_events from anon, authenticated;
grant select on public.platform_runtime_events to authenticated;

create or replace function public.record_runtime_event(
  target_organization_id uuid,
  event_severity text,
  event_type text default 'ui_feedback',
  event_module text default null,
  event_route text default null,
  event_operation text default null,
  event_user_message text default null,
  event_diagnostic_code text default null,
  event_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role public.app_role;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if target_organization_id is null then
    raise exception 'ORG_REQUIRED';
  end if;
  if event_severity not in ('info','success','warning','error','blocked') then
    raise exception 'INVALID_SEVERITY';
  end if;
  if coalesce(btrim(event_user_message),'') = '' then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  select om.role into v_role
  from public.organization_members om
  where om.organization_id = target_organization_id
    and om.user_id = v_user
    and om.status = 'active'
  order by om.created_at asc
  limit 1;

  if v_role is null and not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.is_platform_owner = true
  ) then
    raise exception 'ORG_ACCESS_DENIED';
  end if;

  if v_role is null and exists (
    select 1 from public.profiles p
    where p.id = v_user and p.is_platform_owner = true
  ) then
    v_role := 'platform_owner'::public.app_role;
  end if;

  insert into public.platform_runtime_events(
    organization_id, actor_id, role, severity, event_type, module, route,
    operation, user_message, diagnostic_code, app_version, occurred_at
  ) values (
    target_organization_id,
    v_user,
    v_role,
    event_severity,
    left(coalesce(nullif(btrim(event_type),''),'ui_feedback'),80),
    nullif(left(coalesce(event_module,''),80),''),
    nullif(left(coalesce(event_route,''),240),''),
    nullif(left(coalesce(event_operation,''),80),''),
    left(btrim(event_user_message),500),
    nullif(left(coalesce(event_diagnostic_code,''),120),''),
    nullif(left(coalesce(event_app_version,''),40),''),
    now()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_runtime_event(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.record_runtime_event(uuid,text,text,text,text,text,text,text,text) to authenticated;

comment on table public.platform_runtime_events is
  'Append-only operational diagnostics visible to Platform Owner. Must not contain clinical/business payloads or secrets.';
comment on function public.record_runtime_event(uuid,text,text,text,text,text,text,text,text) is
  'Records a sanitized runtime event for an authenticated member or Platform Owner. Actor/role are derived server-side.';
