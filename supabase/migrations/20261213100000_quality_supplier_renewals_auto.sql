-- Supplier certificates: Hospital Admin and Quality Manager may e-mail the suppliers with
-- expired certificates (until now only the Platform Owner and designated members), and a
-- nightly job can do it by itself, per hospital, when switched on (off by default):
-- it sends the request for every expired certificate not yet asked for, reminds the
-- suppliers who have not answered after a few days, and tells the Platform Owner when
-- suppliers have submitted new certificates.

-- The sender: the Platform Owner, the Hospital Admin and Quality Manager of the
-- organization, a member with the add-on supplier_renewal_sender, or the nightly job
-- (no user; marked by a setting only its own transaction sets).
create or replace function private.quality_supplier_renewal_can_send(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select public.current_user_is_platform_owner()
    or (auth.uid() is null and coalesce(current_setting('limoxis.supplier_renewal_auto', true), '') = 'on')
    or exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid() and m.organization_id = p_organization_id and m.status = 'active'
      and m.role = any (array['hospital_admin', 'quality_manager']::public.app_role[]))
    or exists (
    select 1 from public.organization_members m
    join public.organization_member_capabilities c on c.membership_id = m.id
    where m.user_id = auth.uid() and m.organization_id = p_organization_id and m.status = 'active'
      and c.capability = 'supplier_renewal_sender' and c.effect = 'grant');
$function$;

alter table public.quality_supplier_certificate_request_items add column if not exists owner_notified_at timestamptz;

-- The nightly setting of a hospital.
create table if not exists public.quality_supplier_renewal_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  auto_enabled boolean not null default false,
  remind_after_days smallint not null default 7 check (remind_after_days between 3 and 30),
  max_reminders smallint not null default 2 check (max_reminders between 0 and 5),
  last_run_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.quality_supplier_renewal_settings enable row level security;
revoke all on table public.quality_supplier_renewal_settings from anon, authenticated;
grant select on table public.quality_supplier_renewal_settings to authenticated;
create policy quality_supplier_renewal_settings_read on public.quality_supplier_renewal_settings for select to authenticated
  using (public.current_user_is_platform_owner() or organization_id = any (private.current_user_quality_read_orgs()));
comment on table public.quality_supplier_renewal_settings is 'Nightly e-mailing of suppliers with expired certificates, per hospital (off by default). Written only by quality_supplier_renewal_settings_set.';

create or replace function public.quality_supplier_renewal_settings_set(p_organization_id uuid, p_auto_enabled boolean, p_remind_after_days integer default 7, p_max_reminders integer default 2)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if p_organization_id is null or auth.uid() is null or not private.quality_supplier_renewal_can_send(p_organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;
  insert into public.quality_supplier_renewal_settings(organization_id, auto_enabled, remind_after_days, max_reminders, updated_by, updated_at)
  values (p_organization_id, coalesce(p_auto_enabled, false), least(30, greatest(3, coalesce(p_remind_after_days, 7))), least(5, greatest(0, coalesce(p_max_reminders, 2))), auth.uid(), now())
  on conflict (organization_id) do update
    set auto_enabled = excluded.auto_enabled, remind_after_days = excluded.remind_after_days, max_reminders = excluded.max_reminders,
        updated_by = excluded.updated_by, updated_at = now();
end;
$function$;
revoke all on function public.quality_supplier_renewal_settings_set(uuid, boolean, integer, integer) from public, anon;
grant execute on function public.quality_supplier_renewal_settings_set(uuid, boolean, integer, integer) to authenticated;

-- The nightly job, for every hospital that switched it on:
--   1. a request (one e-mail per supplier and address) for each expired certificate of
--      an active supplier with a valid e-mail, with nothing open and nothing asked in the
--      last 30 days (so a cancelled or rejected one is not repeated every night);
--   2. a reminder (same link) for a sent request still waiting after remind_after_days,
--      up to max_reminders;
--   3. one e-mail to each Platform Owner for the certificates submitted since the last run.
create or replace function private.quality_supplier_renewals_auto()
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_set public.quality_supplier_renewal_settings;
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_items jsonb;
  v_result jsonb;
  v_created jsonb;
  v_reminded integer;
  v_notified integer;
  v_request uuid;
  v_org_name text;
  v_submitted jsonb;
  v_owner record;
  v_total jsonb := '[]'::jsonb;
begin
  perform set_config('limoxis.supplier_renewal_auto', 'on', true);
  for v_set in select * from public.quality_supplier_renewal_settings s where s.auto_enabled loop
    v_created := '{}'::jsonb; v_reminded := 0; v_notified := 0;
    begin
      select coalesce(jsonb_agg(jsonb_build_object('certification_id', x.certification_id, 'recipient_email', x.email)), '[]'::jsonb) into v_items
      from (
        select c.id as certification_id, e.email
        from public.quality_supplier_certifications c
        join public.quality_suppliers s on s.id = c.supplier_id and s.organization_id = c.organization_id and s.status <> 'inactive'
        cross join lateral (
          select y.email from (
            select lower(btrim(s.email)) as email, 0 as ord
            union all
            select lower(btrim(ct.email)), 1 + coalesce(ct.position, 0)
            from public.quality_supplier_contacts ct where ct.supplier_id = s.id and ct.organization_id = s.organization_id
          ) y where y.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' order by y.ord limit 1) e
        where c.organization_id = v_set.organization_id and c.expires_on < v_today
          and not exists (select 1 from public.quality_supplier_certificate_request_items i
                          where i.certification_id = c.id and (i.status in ('pending', 'submitted') or i.created_at > now() - interval '30 days'))
        order by c.expires_on limit 400) x;
      if jsonb_array_length(v_items) > 0 then
        v_created := public.quality_supplier_certificate_requests_create(v_set.organization_id, v_items, true);
      end if;

      for v_request in
        select r.id from public.quality_supplier_certificate_requests r
        where r.organization_id = v_set.organization_id and r.status = 'sent' and r.reminder_count < v_set.max_reminders
          and coalesce(r.last_reminder_at, r.first_sent_at, r.sent_at) <= now() - make_interval(days => v_set.remind_after_days)
          and exists (select 1 from public.quality_supplier_certificate_request_items i where i.request_id = r.id and i.status = 'pending')
        order by r.sent_at limit 200 loop
        begin
          perform private.quality_supplier_certificate_remind(v_request);
          v_reminded := v_reminded + 1;
        exception when others then
          null;
        end;
      end loop;

      v_org_name := (select o.name from public.organizations o where o.id = v_set.organization_id);
      v_submitted := coalesce((select jsonb_agg(jsonb_build_object('supplier', coalesce(s.name, ''), 'type', coalesce(i.certificate_type, ''), 'number', coalesce(i.certificate_number, ''), 'expiresOn', i.expires_on) order by s.name, i.submitted_at)
        from public.quality_supplier_certificate_request_items i left join public.quality_suppliers s on s.id = i.supplier_id and s.organization_id = i.organization_id
        where i.organization_id = v_set.organization_id and i.status = 'submitted' and i.owner_notified_at is null), '[]'::jsonb);
      if jsonb_array_length(v_submitted) > 0 then
        for v_owner in
          select p.id, coalesce(nullif(btrim(p.contact_email), ''), u.email) as email
          from public.profiles p join auth.users u on u.id = p.id where p.is_platform_owner loop
          if v_owner.email is null then continue; end if;
          insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
          values (v_set.organization_id, v_owner.id, v_owner.email, 'supplier_certificate_submitted', 'supplier_certificate_submitted:' || to_char(now(), 'YYYYMMDDHH24MISS'), v_set.organization_id,
            'Νέα πιστοποιητικά προμηθευτών (' || jsonb_array_length(v_submitted) || ') · ' || coalesce(v_org_name, ''),
            jsonb_build_object('organizationName', coalesce(v_org_name, ''), 'certificates', v_submitted, 'language', 'el', 'path', '/quality/resources/suppliers/renewals'), 'pending', 0, now())
          on conflict do nothing;
          v_notified := v_notified + 1;
        end loop;
        update public.quality_supplier_certificate_request_items i set owner_notified_at = now()
         where i.organization_id = v_set.organization_id and i.status = 'submitted' and i.owner_notified_at is null;
      end if;
      v_result := jsonb_build_object('ok', true, 'created', v_created, 'reminded', v_reminded, 'notified', v_notified);
    exception when others then
      v_result := jsonb_build_object('ok', false, 'error', sqlerrm);
    end;
    update public.quality_supplier_renewal_settings s set last_run_at = now(), last_result = v_result where s.organization_id = v_set.organization_id;
    v_total := v_total || jsonb_build_object('organization_id', v_set.organization_id, 'result', v_result);
  end loop;
  return v_total;
end;
$function$;
revoke all on function private.quality_supplier_renewals_auto() from public, anon, authenticated;

-- Every night before the e-mails are sent out (limoxis-demo-housekeeping, 02:17 UTC).
select cron.schedule('limoxis-supplier-renewals', '5 2 * * *', 'select private.quality_supplier_renewals_auto();');
