-- Demo evaluation, phase 4: the evaluation guide's progress and "I want the
-- application" requests. Both tables point to the Demo through
-- demo_organization_id (not organization_id) so that "Reset data" keeps them:
-- private.demo_wipe_data clears every table with an organization_id column.
-- Deleting the Demo removes them (on delete cascade).
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- 1. Evaluation guide progress --------------------------------------------------
create table if not exists public.demo_evaluation_progress (
  demo_organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null check (step_key in ('guide_opened', 'patient_admission', 'clabsi_classification', 'microbiology_mdro',
    'hand_hygiene', 'incident_capa', 'analysis_export')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (demo_organization_id, user_id, step_key)
);
create index if not exists demo_evaluation_progress_user_idx on public.demo_evaluation_progress(user_id);

alter table public.demo_evaluation_progress enable row level security;
create policy demo_evaluation_progress_read on public.demo_evaluation_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_user_is_platform_owner()));
revoke all on public.demo_evaluation_progress from anon;
grant select on public.demo_evaluation_progress to authenticated;

-- Marks a guide step done (or not done) for the signed-in member of a Demo.
create or replace function public.demo_set_evaluation_step(p_organization_id uuid, p_step text, p_done boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members om join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active' and o.is_demo
  ) then
    raise exception 'Not a member of this Demo' using errcode = '42501';
  end if;
  insert into public.demo_evaluation_progress(demo_organization_id, user_id, step_key, completed_at, updated_at)
  values (p_organization_id, auth.uid(), p_step, case when coalesce(p_done, true) then now() end, now())
  on conflict (demo_organization_id, user_id, step_key)
  do update set completed_at = case when coalesce(p_done, true) then coalesce(public.demo_evaluation_progress.completed_at, now()) end, updated_at = now();
  return coalesce((select jsonb_object_agg(p.step_key, p.completed_at) from public.demo_evaluation_progress p
    where p.demo_organization_id = p_organization_id and p.user_id = auth.uid() and p.completed_at is not null), '{}'::jsonb);
end;
$function$;

revoke all on function public.demo_set_evaluation_step(uuid, text, boolean) from public, anon;
grant execute on function public.demo_set_evaluation_step(uuid, text, boolean) to authenticated;

-- 2. "I want the application" ---------------------------------------------------
create table if not exists public.demo_application_requests (
  id uuid primary key default gen_random_uuid(),
  demo_organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 60),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists demo_application_requests_org_idx on public.demo_application_requests(demo_organization_id, created_at desc);
create index if not exists demo_application_requests_user_idx on public.demo_application_requests(user_id);
create index if not exists demo_application_requests_handled_by_idx on public.demo_application_requests(handled_by);

alter table public.demo_application_requests enable row level security;
create policy demo_application_requests_read on public.demo_application_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_user_is_platform_owner()));
create policy demo_application_requests_owner_update on public.demo_application_requests for update to authenticated
  using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
revoke all on public.demo_application_requests from anon;
grant select, update on public.demo_application_requests to authenticated;

-- The evaluator's request: stored, written to the audit log and e-mailed to
-- every Platform Owner through the notification outbox. At most three a day.
create or replace function public.demo_request_application(p_organization_id uuid, p_contact_name text, p_contact_phone text default null, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_role public.app_role := (select om.role from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active' limit 1);
  v_email text := (select u.email from auth.users u where u.id = auth.uid());
  v_org_name text := (select o.name from public.organizations o where o.id = p_organization_id and o.is_demo);
  v_entitlement uuid := (select e.id from public.platform_demo_entitlements e where e.organization_id = p_organization_id order by e.created_at desc limit 1);
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_org_name is null or v_role is null then
    raise exception 'Not a member of this Demo' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'A contact name is required' using errcode = '22023';
  end if;
  if (select count(*) from public.demo_application_requests r where r.user_id = auth.uid() and r.created_at > v_now - interval '1 day') >= 3 then
    raise exception 'Too many requests today' using errcode = '54000';
  end if;

  insert into public.demo_application_requests(id, demo_organization_id, user_id, contact_name, contact_email, contact_phone, message, created_at)
  values (v_id, p_organization_id, auth.uid(), left(v_name, 200), left(v_email, 320), left(v_phone, 60), left(v_message, 2000), v_now);

  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), v_role, 'platform.demo.application_requested', 'demo_application_request', v_id::text,
    jsonb_build_object('organization_name', v_org_name, 'contact_name', v_name, 'contact_email', v_email, 'contact_phone', v_phone));

  insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
  select p_organization_id, p.id, u.email, 'demo_application_request', 'demo_application_request', v_id,
    'Αίτημα για την εφαρμογή από Demo: ' || v_org_name,
    jsonb_build_object('path', '/platform#demo' || case when v_entitlement is null then '' else '?demo=' || v_entitlement::text end,
      'organizationName', v_org_name, 'contactName', v_name, 'contactEmail', v_email, 'contactPhone', v_phone, 'message', v_message, 'language', 'el'),
    'pending', 0, v_now
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p.is_platform_owner, false) and u.email is not null;

  return jsonb_build_object('id', v_id, 'createdAt', v_now);
end;
$function$;

revoke all on function public.demo_request_application(uuid, text, text, text) from public, anon;
grant execute on function public.demo_request_application(uuid, text, text, text) to authenticated;
