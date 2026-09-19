-- Analysis-page audit finding (P1, architecture): the "Ανάλυση" page has an
-- entirely separate calculation pipeline from the indicator engine
-- (platform_report_summary + loadMicrobiologyAnalytics in
-- platformService.js, vs private.indicator_metric_snapshot) and shares zero
-- code with it. In particular loadMicrobiologyAnalytics queries
-- microbiology_results directly with only `result_status='positive'` —
-- unlike every microbiology aggregate in indicator_metric_snapshot, it never
-- excludes draft results (validation_status not in ('validated','amended'))
-- or superseded ones (a result some later result was amended from), and it
-- groups by the raw resistance_class column, ignoring an amr_classifications
-- override the same way the indicator engine already accounts for. So the
-- Analysis page independently reproduces bugs already fixed elsewhere.
--
-- Fix (first step of the chosen "full reconnection" direction): extract the
-- one predicate that decides "which microbiology findings count, and what
-- their effective resistance classification is" into a single function, with
-- a body identical to the one repeated across every microbiology aggregate
-- in indicator_metric_snapshot (see e.g. 20260919270000, lines 61-62 and
-- 84-85). Both places now read from this one definition instead of each
-- maintaining their own copy.
--
-- Deliberately NOT security definer: the existing client-side query it
-- replaces ran under RLS as the calling user, and indicator_metric_snapshot
-- is security definer only because it also has to enforce its own indicator-
-- specific access gate (view_indicators capability, department scope) up
-- front — the exact kind of gate that fell out of sync with capability
-- changes and caused the P0 occupational-health leak this session already
-- fixed. This function carries no such gate of its own: it relies entirely
-- on the RLS policies already in force on microbiology_results,
-- laboratory_samples, departments and amr_classifications for access
-- control, so there is nothing here that can fall out of sync.

create or replace function public.analysis_microbiology_findings(
  p_organization_id uuid,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns table (
  organization_id uuid,
  microbiology_result_id uuid,
  organism text,
  resistance_class text,
  is_critical boolean,
  department_id uuid,
  department_name text,
  source text,
  sample_type text,
  event_date date
)
language sql
stable
set search_path to 'public'
as $function$
  select
    m.organization_id,
    m.id,
    m.organism,
    case
      when exists (
        select 1 from amr_classifications a
        where a.organization_id = m.organization_id
          and a.microbiology_result_id = m.id
          and a.status <> 'rejected'
          and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
      ) then (
        select upper(a.classification) from amr_classifications a
        where a.organization_id = m.organization_id
          and a.microbiology_result_id = m.id
          and a.status <> 'rejected'
          and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
        order by a.created_at desc limit 1
      )
      else m.resistance_class
    end as resistance_class,
    m.is_critical,
    l.department_id,
    d.name,
    coalesce(nullif(btrim(l.source_site), ''), l.sample_type, '—'),
    l.sample_type,
    coalesce(m.resulted_at::date, l.collected_at::date)
  from microbiology_results m
  join laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
  left join departments d on d.id = l.department_id
  where m.organization_id = p_organization_id
    and (p_department_id is null or l.department_id = p_department_id)
    and m.result_status = 'positive'
    and m.validation_status in ('validated', 'amended')
    and not exists (
      select 1 from microbiology_results m2
      where m2.organization_id = m.organization_id and m2.amended_from = m.id
    )
    and (p_from is null or coalesce(m.resulted_at::date, l.collected_at::date) >= p_from)
    and (p_to is null or coalesce(m.resulted_at::date, l.collected_at::date) <= p_to);
$function$;

grant execute on function public.analysis_microbiology_findings(uuid, date, date, uuid) to authenticated;
