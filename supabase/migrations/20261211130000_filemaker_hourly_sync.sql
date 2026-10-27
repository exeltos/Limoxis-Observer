-- FileMaker → Limoxis, every hour while the hospital still records in FileMaker
-- (approved by the owner on 27/10/2026, for what is entered from 19/10/2026 on).
--   :05  private.fm_sync_requeue()  the FileMaker tables are read again by the
--        minute pull (filemaker_import_dispatch): PerformedControls from a page
--        before its end (new entries are appended), the small tables whole;
--   :35  private.fm_sync_all()      what was read and is not yet in Limoxis is
--        added, the same way as the first transfer. Insert only: every record
--        added is linked in fm_stage_links, so a record is never added twice.
-- Stop it with: update public.fm_stage_settings set enabled = false;

-- Which FileMaker tables the hourly sync reads again.
create or replace function private.fm_sync_tables()
returns text[] language sql immutable set search_path = '' as $$
  select array['PerformedControls']
$$;

create or replace function private.fm_sync_requeue()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select s.enabled from public.fm_stage_settings s where s.id), false) then return; end if;
  update public.fm_stage_tables t
     set status = 'pending',
         next_skip = case when t.base_table = 'PerformedControls' then greatest(0, t.fetched - 500) else 0 end,
         fetched = case when t.base_table = 'PerformedControls' then greatest(0, t.fetched - 500) else 0 end,
         finished_at = null, last_error = null
   where t.base_table = any(private.fm_sync_tables()) and t.status in ('done', 'error');
end;
$$;

-- The control entries (PerformedControls) from 19/10/2026 on: the control's
-- department assignment through its Controls link (paused ones left out), the
-- value or text from ControlResult, «Μη συμμόρφωση» and a finding for
-- «Ανεπιτυχής» or a value outside the limits, the controller's name from People
-- (else the name the account's entries had). Beyond a period's required
-- entries an entry is extra («Επιπλέον καταγραφή στο FileMaker»).
create or replace function private.fm_sync_controls()
returns integer language plpgsql security definer set search_path = '' set plan_cache_mode = force_custom_plan as $$
declare v_count integer;
begin
  with src as materialized (
    select r.record_id, r.data d,
           coalesce(nullif(r.data->>'CreationTimestamp', '')::timestamp,
                    (r.data->>'ControlDate')::date + coalesce(nullif(r.data->>'creation time', '')::time, '12:00'::time)) at time zone 'Europe/Athens' as at_ts,
           nullif(btrim(r.data->>'ControlResult'), '') as res,
           r.data->>'ControlEvaluation' as ev
    from public.fm_stage_records r
    where r.base_table = 'PerformedControls'
      and r.record_id::bigint > 187110
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'PerformedControls' and l.record_id = r.record_id)
  ), people as materialized (
    select distinct on (p.data->>'People ID') p.data->>'People ID' as people_id, p.data->>'People_SurnameName' as name
    from public.fm_stage_records p where p.base_table = 'People' and p.data->>'People ID' is not null
  ), accounts as materialized (
    select distinct on (r2.data->>'DataEntryAccount') r2.data->>'DataEntryAccount' as account, e2.response_data->>'actorName' as actor
    from public.fm_stage_records r2
    join public.fm_stage_links l2 on l2.base_table = 'PerformedControls' and l2.record_id = r2.record_id
    join public.control_executions e2 on e2.id = l2.target_id
    where r2.base_table = 'PerformedControls' and r2.record_id::bigint > 180000 and r2.data->>'ControlerID' is null
    order by r2.data->>'DataEntryAccount', r2.record_id::bigint desc
  ), mapped as (
    select s.*, a.id as assignment_id, a.control_id, a.organization_id, a.department_id,
           coalesce(a.frequency_config, def.frequency_config, '{"kind":"daily","times":["09:00"]}'::jsonb) as freq,
           coalesce(a.response_override, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('mode', def.response_config->'mode', 'min', coalesce(a.response_override->'min', def.response_config->'min'), 'max', coalesce(a.response_override->'max', def.response_config->'max'))) as cfg,
           substring(s.res from '^\s*([+-]?[0-9]+(?:[.,][0-9]+)?)\s*(?:°|o|ο)?\s*[CcCс]?\s*$') as num,
           coalesce(pp.name, acc.actor, s.d->>'DataEntryAccount') as actor
    from src s
    left join people pp on pp.people_id = s.d->>'ControlerID'
    left join accounts acc on acc.account = s.d->>'DataEntryAccount'
    join public.fm_stage_records c on c.base_table = 'Controls' and c.data->>'ControlID_PrimaryKey' = s.d->>'ControlID'
    join public.fm_stage_links lc on lc.base_table = 'Controls' and lc.record_id = c.record_id and lc.target_table = 'control_assignments'
    join public.control_assignments a on a.id = lc.target_id and a.status = 'scheduled'
    join public.control_definitions def on def.id = a.control_id
    where s.at_ts >= timestamptz '2026-10-19 00:00:00+03' and s.at_ts <= now()
  ), rows as (
    select m.*, md5('fm-PerformedControls-' || m.record_id)::uuid as new_id,
           case when m.cfg->>'mode' = 'numeric' then replace(m.num, ',', '.')
                when m.ev = 'Επιτυχής' then 'Συμμορφώνεται'
                when m.ev = 'Ανεπιτυχής' then 'Μη συμμόρφωση' end as value_text,
           case when m.cfg->>'mode' = 'numeric' and m.num is not null then null else replace(m.res, E'\r', E'\n') end as result_text,
           (m.ev = 'Ανεπιτυχής'
            or (m.cfg->>'mode' = 'numeric' and m.num is not null and (
                 (m.cfg->>'min' ~ '^-?[0-9.]+$' and replace(m.num, ',', '.')::numeric < (m.cfg->>'min')::numeric)
              or (m.cfg->>'max' ~ '^-?[0-9.]+$' and replace(m.num, ',', '.')::numeric > (m.cfg->>'max')::numeric)))) as has_finding,
           (select count(*) from public.control_executions x
             where x.assignment_id = m.assignment_id and x.status <> 'cancelled' and x.cancelled_at is null and not x.is_extra
               and x.performed_at >= private.control_period_start(m.freq, m.at_ts) and x.performed_at < private.control_period_end(m.freq, m.at_ts))
           + row_number() over (partition by m.assignment_id, private.control_period_start(m.freq, m.at_ts) order by m.at_ts, m.record_id)
           > private.control_required(m.freq) as extra
    from mapped m
  ), ins as (
    insert into public.control_executions (id, organization_id, control_id, assignment_id, department_id, performed_at, performed_by, status, value_text, result_text, notes, has_finding, response_data, created_at, is_extra, extra_reason)
    select r.new_id, r.organization_id, r.control_id, r.assignment_id, r.department_id, r.at_ts, '84066ee0-57b7-4cae-9186-09e491d3ea6d', 'completed',
           r.value_text, r.result_text, nullif(replace(btrim(coalesce(r.d->>'ControlNotes', '')), E'\r', E'\n'), ''), coalesce(r.has_finding, false),
           jsonb_build_object('evidence', '[]'::jsonb, 'actorName', r.actor, 'actorEmail', '', 'structuredData', null, 'previousNextDueAt', null, 'previousLastCompletedAt', null),
           r.at_ts, r.extra, case when r.extra then 'Επιπλέον καταγραφή στο FileMaker' end
    from rows r
    on conflict (id) do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'PerformedControls', r.record_id, 'control_executions', r.new_id, 'created', 'hourly sync', now()
    from rows r join ins on ins.id = r.new_id
    returning 1
  )
  select count(*) into v_count from links;
  return v_count;
end;
$$;

-- Every area of the hourly sync; the result goes to fm_stage_settings.last_result.
create or replace function private.fm_sync_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not coalesce((select s.enabled from public.fm_stage_settings s where s.id), false) then return null; end if;
  v_result := jsonb_build_object('task', 'hourly_sync', 'at', now(), 'controls', private.fm_sync_controls());
  update public.fm_stage_settings set last_result = v_result where id;
  return v_result;
end;
$$;

select cron.schedule('limoxis-filemaker-requeue', '5 * * * *', 'select private.fm_sync_requeue();');
select cron.schedule('limoxis-filemaker-sync', '35 * * * *', 'select private.fm_sync_all();');
