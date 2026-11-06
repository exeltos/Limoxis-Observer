-- FileMaker «Deviations» in the nightly sync: «Παράπονο Πελάτη» becomes a complaint (quality_incidents,
-- report_kind 'complaint'), every other origin a deviation (quality_findings). Records already brought over on 27/10
-- are linked by their code first, so only new ones are created.
create or replace function private.fm_sync_deviations()
returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare v_count integer;
begin
  -- The ones brought over earlier: matched by code (FND-…-<last 6 digits>, INC-…-<Dev ID>).
  insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
  select 'Deviations', r.record_id, 'quality_findings', f.id, 'matched', 'by code', now()
  from public.fm_stage_records r
  join public.quality_findings f on f.organization_id = private.fm_org()
   and f.code = 'FND-' || to_char(nullif(r.data->>'Dev Date', '')::date, 'YYMMDD') || '-' || right(r.data->>'Dev ID', 6)
  where r.base_table = 'Deviations' and coalesce(r.data->>'Dev Origin Text', '') <> 'Παράπονο Πελάτη'
  on conflict do nothing;
  insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
  select 'Deviations', r.record_id, 'quality_incidents', i.id, 'matched', 'by code', now()
  from public.fm_stage_records r
  join public.quality_incidents i on i.organization_id = private.fm_org()
   and i.code = 'INC-' || to_char(nullif(r.data->>'Dev Date', '')::date, 'YYMMDD') || '-' || (r.data->>'Dev ID')
  where r.base_table = 'Deviations' and r.data->>'Dev Origin Text' = 'Παράπονο Πελάτη'
  on conflict do nothing;

  with src as (
    select r.record_id, r.data d, nullif(r.data->>'Dev Date', '')::date as day,
           r.data->>'Dev Origin Text' = 'Παράπονο Πελάτη' as complaint,
           nullif(concat_ws(E'\n\n', private.fm_text(r.data->>'Dev Description'),
             'Αίτια: ' || private.fm_text(r.data->>'Dev Cause Analysis'),
             'Διόρθωση: ' || private.fm_text(r.data->>'Dev Correction')), '') as body,
           case r.data->>'Dev Consequences Impact' when '5' then 'critical' when '4' then 'high' when '3' then 'medium'
                when '2' then 'low' when '1' then 'low' else 'medium' end as severity,
           coalesce(private.fm_text(r.data->>'Evaluator'), private.fm_text(r.data->>'Evaluator 2'), private.fm_text(r.data->>'Evaluator 3')) as evaluator
    from public.fm_stage_records r
    where r.base_table = 'Deviations' and nullif(r.data->>'Dev Date', '') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Deviations' and l.record_id = r.record_id)
  ), findings as (
    insert into public.quality_findings (id, organization_id, code, title, department_id, identified_at, severity, status, description,
      source_type, owner_label, owner_labels, lifecycle_status, history, created_at)
    select md5('fm-Deviations-' || s.record_id)::uuid, private.fm_org(),
           'FND-' || to_char(s.day, 'YYMMDD') || '-' || right(s.d->>'Dev ID', 6),
           coalesce(private.fm_text(s.d->>'Dev Title'), private.fm_text(s.d->>'Dev Origin Text'), 'Απόκλιση'),
           private.fm_department(s.d->>'CreatedBy'), (s.day::timestamp + interval '12 hours') at time zone 'UTC',
           s.severity, case s.d->>'Dev Status' when 'Ολοκληρωμένη' then 'closed' when 'Εκκρεμή' then 'in_progress' else 'open' end,
           s.body, 'manual', s.evaluator, case when s.evaluator is null then '{}'::text[] else array[s.evaluator] end,
           'active', '[]'::jsonb, now()
    from src s where not s.complaint
    on conflict do nothing
    returning id
  ), complaints as (
    insert into public.quality_incidents (id, organization_id, code, title, department_id, occurred_at, severity, status, description,
      category, report_kind, reported_by_label, owner_label, owner_labels, root_cause, immediate_actions, lifecycle_status, history, created_at)
    select md5('fm-Deviations-' || s.record_id)::uuid, private.fm_org(),
           'INC-' || to_char(s.day, 'YYMMDD') || '-' || (s.d->>'Dev ID'),
           coalesce(private.fm_text(s.d->>'Dev Title'), 'Παράπονο'),
           private.fm_department(s.d->>'CreatedBy'), (s.day::timestamp + interval '12 hours') at time zone 'UTC',
           null, case s.d->>'Dev Status' when 'Ολοκληρωμένη' then 'closed' else 'reported' end,
           private.fm_text(s.d->>'Dev Description'), 'complaint', 'complaint', private.fm_text(s.d->>'Dev Reported By'),
           s.evaluator, case when s.evaluator is null then '{}'::text[] else array[s.evaluator] end,
           private.fm_text(s.d->>'Dev Cause Analysis'), private.fm_text(s.d->>'Dev Correction'), 'active', '[]'::jsonb, now()
    from src s where s.complaint
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Deviations', s.record_id, case when s.complaint then 'quality_incidents' else 'quality_findings' end,
           md5('fm-Deviations-' || s.record_id)::uuid, 'created', 'nightly sync', now()
    from src s
    where md5('fm-Deviations-' || s.record_id)::uuid in (select id from findings union all select id from complaints)
    returning 1
  )
  select count(*) into v_count from links;
  return v_count;
end;
$fn$;

-- In the nightly sync, applied in place (replace on pg_get_functiondef, as the other FileMaker steps):
-- * private.fm_sync_tables(): 'Deviations' added after 'Death', so the nightly requeue pulls it again;
-- * private.fm_sync_all(): 'deviations', private.fm_sync_deviations() after the incidents.
