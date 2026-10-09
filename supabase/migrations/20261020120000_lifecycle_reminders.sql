-- Lifecycle reminders (approved by the platform owner):
--   * a Demo that ends in 7 days and in 1 day: e-mail to every Platform Owner
--     and to the Demo's main user;
--   * a hospital scheduled for deletion in 7 days and in 1 day: e-mail to every
--     Platform Owner;
--   * a hospital that reached its deletion date: one notice to every Platform
--     Owner (the permanent deletion stays a manual, ticketed action).
-- The nightly job writes the reminders into notification_outbox and asks the
-- platform-scheduled-tasks Edge Function (pg_net, shared secret in Vault) to
-- send them, so they go out even when nobody opens the platform.
-- Each reminder is written once: its key carries the date it refers to, so an
-- extension or a new deletion date gets reminders of its own.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create extension if not exists pg_net with schema extensions;

-- The secret the nightly job sends and the Edge Function checks.
do $$
begin
  if not exists (select 1 from vault.secrets s where s.name = 'limoxis_scheduler_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limoxis_scheduler_secret',
      'Shared secret between pg_cron and the platform-scheduled-tasks Edge Function');
  end if;
end $$;

-- Only the Edge Function (service role) may check the secret.
create or replace function public.platform_scheduler_secret_valid(p_secret text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select coalesce(p_secret, '') <> ''
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret' and s.decrypted_secret = p_secret);
$function$;
revoke all on function public.platform_scheduler_secret_valid(text) from public, anon, authenticated;
grant execute on function public.platform_scheduler_secret_valid(text) to service_role;

create or replace function private.platform_owner_recipients()
returns table(user_id uuid, email text, full_name text)
language sql stable security definer set search_path = ''
as $function$
  select p.id, coalesce(nullif(btrim(p.contact_email), ''), u.email), coalesce(nullif(btrim(p.full_name), ''), 'Platform Owner')
  from public.profiles p join auth.users u on u.id = p.id
  where coalesce(p.is_platform_owner, false) and coalesce(nullif(btrim(p.contact_email), ''), u.email) is not null;
$function$;
revoke all on function private.platform_owner_recipients() from public, anon, authenticated;

create or replace function private.platform_lifecycle_reminders()
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_count integer := 0;
  v_rows integer;
begin
  -- 1. Demo ends in 7 days / tomorrow (valid_until is the last day of access).
  insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
  select e.organization_id, r.user_id, r.email, 'platform_lifecycle_reminder', 'demo_expiry_' || d.days || 'd:' || e.valid_until::text, e.id,
    'Demo «' || coalesce(o.name, e.label) || '»: ισχύει έως ' || to_char(e.valid_until, 'DD/MM/YYYY'),
    jsonb_build_object('kind', 'demo_expiry', 'audience', r.audience, 'days', d.days, 'name', coalesce(o.name, e.label), 'code', o.code,
      'date', e.valid_until, 'recipientName', r.full_name,
      'path', case when r.audience = 'owner' then '/platform#demo?demo=' || e.id::text else '/' end, 'language', 'el'),
    'pending', 0, now()
  from public.platform_demo_entitlements e
  join public.organizations o on o.id = e.organization_id
  cross join lateral (select e.valid_until - current_date as days) d
  cross join lateral (
    select x.user_id, x.email, x.full_name, 'owner'::text as audience from private.platform_owner_recipients() x
    union all
    select p.id, coalesce(nullif(btrim(p.contact_email), ''), u.email), coalesce(nullif(btrim(p.full_name), ''), e.contact_name, ''), 'evaluator'
    from public.profiles p join auth.users u on u.id = p.id
    where p.id = e.demo_user_id and not coalesce(p.is_platform_owner, false)
      and coalesce(nullif(btrim(p.contact_email), ''), u.email) is not null
  ) r
  where e.status = 'active' and d.days in (7, 1)
  on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- 2. Hospital deletion in 7 days / tomorrow, and the day it is due.
  insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
  select o.id, r.user_id, r.email, 'platform_lifecycle_reminder', d.stage || ':' || (o.deletion_scheduled_at::date)::text, o.id,
    case when d.stage = 'deletion_due' then '«' || o.name || '»: έφτασε η ημερομηνία οριστικής διαγραφής'
         else '«' || o.name || '»: οριστική διαγραφή στις ' || to_char(o.deletion_scheduled_at, 'DD/MM/YYYY') end,
    jsonb_build_object('kind', case when d.stage = 'deletion_due' then 'deletion_due' else 'deletion' end, 'audience', 'owner', 'days', d.days,
      'name', o.name, 'code', o.code, 'date', o.deletion_scheduled_at::date, 'recipientName', r.full_name,
      'path', '/platform#organizations?organization=' || o.id::text || '&tab=offboarding', 'language', 'el'),
    'pending', 0, now()
  from public.organizations o
  cross join lateral (select o.deletion_scheduled_at::date - current_date as days) dd
  cross join lateral (select dd.days,
    case when dd.days <= 0 then 'deletion_due' when dd.days = 7 then 'deletion_7d' when dd.days = 1 then 'deletion_1d' end as stage) d
  cross join private.platform_owner_recipients() r
  where o.deletion_scheduled_at is not null and not o.is_demo and d.stage is not null
  on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  return v_count;
end;
$function$;
revoke all on function private.platform_lifecycle_reminders() from public, anon, authenticated;

-- Ask the Edge Function to send what is pending. Needs the project's functions
-- URL in Vault (limoxis_functions_url); without it the reminders simply wait
-- until the next run that has it.
create or replace function private.platform_dispatch_scheduled_tasks()
returns bigint language plpgsql security definer set search_path = ''
as $function$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_functions_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret');
begin
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/platform-scheduled-tasks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := jsonb_build_object('task', 'lifecycle_reminders'),
    timeout_milliseconds := 30000);
end;
$function$;
revoke all on function private.platform_dispatch_scheduled_tasks() from public, anon, authenticated;

-- The nightly job: expire Demos, apply access, write and send the reminders.
select cron.schedule('limoxis-demo-housekeeping', '17 2 * * *',
  'select private.platform_demo_housekeeping(); select private.apply_all_org_access(); select private.platform_lifecycle_reminders(); select private.platform_dispatch_scheduled_tasks();');
