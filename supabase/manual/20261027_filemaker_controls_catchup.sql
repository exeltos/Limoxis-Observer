-- FileMaker → Limoxis (run by the agent on 27/10/2026, kept for the next catch-up):
-- the PerformedControls entries read again from FileMaker (fm_stage_tables
-- PerformedControls set back to 'pending' a page before the end) and not yet in
-- control_executions, up to the end of yesterday (Athens), the same way as the
-- first transfer: the control's department assignment through its Controls link,
-- the value or text from ControlResult, «Μη συμμόρφωση» and a finding for
-- «Ανεπιτυχής» or a value outside the limits, the controller's name from People
-- (else the name the account's entries had). Paused assignments are left out.
-- Insert only; each entry is linked in fm_stage_links, so a second run adds nothing.
with src as materialized (
  select r.record_id, r.data d,
         coalesce(nullif(r.data->>'CreationTimestamp','')::timestamp,
                  (r.data->>'ControlDate')::date + coalesce(nullif(r.data->>'creation time','')::time, '12:00'::time)) at time zone 'Europe/Athens' as at_ts,
         nullif(btrim(r.data->>'ControlResult'),'') as res,
         r.data->>'ControlEvaluation' as ev
  from public.fm_stage_records r
  where r.base_table = 'PerformedControls'
    and r.record_id::bigint > 187110  -- after the first transfer (18/10/2026)
    and not exists (select 1 from public.fm_stage_links l where l.base_table = 'PerformedControls' and l.record_id = r.record_id)
), people as materialized (
  select distinct on (p.data->>'People ID') p.data->>'People ID' as people_id, p.data->>'People_SurnameName' as name
  from public.fm_stage_records p where p.base_table = 'People' and p.data->>'People ID' is not null
), accounts as materialized (
  -- The name the first transfer gave to an account's entries without a controller.
  select distinct on (r2.data->>'DataEntryAccount') r2.data->>'DataEntryAccount' as account, e2.response_data->>'actorName' as actor
  from public.fm_stage_records r2
  join public.fm_stage_links l2 on l2.base_table = 'PerformedControls' and l2.record_id = r2.record_id
  join public.control_executions e2 on e2.id = l2.target_id
  where r2.base_table = 'PerformedControls' and r2.record_id::bigint > 180000 and r2.data->>'ControlerID' is null
  order by r2.data->>'DataEntryAccount', r2.record_id::bigint desc
), mapped as (
  select s.*, a.id as assignment_id, a.control_id, a.organization_id, a.department_id,
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
  where s.at_ts < (date_trunc('day', now() at time zone 'Europe/Athens') at time zone 'Europe/Athens')
), rows as (
  select m.*, md5('fm-PerformedControls-' || m.record_id)::uuid as new_id,
         case when m.cfg->>'mode' = 'numeric' then replace(m.num, ',', '.')
              when m.ev = 'Επιτυχής' then 'Συμμορφώνεται'
              when m.ev = 'Ανεπιτυχής' then 'Μη συμμόρφωση' end as value_text,
         case when m.cfg->>'mode' = 'numeric' and m.num is not null then null else replace(m.res, E'\r', E'\n') end as result_text,
         (m.ev = 'Ανεπιτυχής'
          or (m.cfg->>'mode' = 'numeric' and m.num is not null and (
               (m.cfg->>'min' ~ '^-?[0-9.]+$' and replace(m.num, ',', '.')::numeric < (m.cfg->>'min')::numeric)
            or (m.cfg->>'max' ~ '^-?[0-9.]+$' and replace(m.num, ',', '.')::numeric > (m.cfg->>'max')::numeric)))) as has_finding
  from mapped m
), ins as (
  insert into public.control_executions (id, organization_id, control_id, assignment_id, department_id, performed_at, performed_by, status, value_text, result_text, notes, has_finding, response_data, created_at)
  select r.new_id, r.organization_id, r.control_id, r.assignment_id, r.department_id, r.at_ts, '84066ee0-57b7-4cae-9186-09e491d3ea6d', 'completed',
         r.value_text, r.result_text, nullif(replace(btrim(coalesce(r.d->>'ControlNotes', '')), E'\r', E'\n'), ''), coalesce(r.has_finding, false),
         jsonb_build_object('evidence', '[]'::jsonb, 'actorName', r.actor, 'actorEmail', '', 'structuredData', null, 'previousNextDueAt', null, 'previousLastCompletedAt', null),
         r.at_ts
  from rows r
  on conflict (id) do nothing
  returning id
)
, links as (
  insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
  select 'PerformedControls', r.record_id, 'control_executions', r.new_id, 'created', 'catch-up', now()
  from rows r join ins on ins.id = r.new_id
  returning record_id
)
select count(*) as transferred from links;
