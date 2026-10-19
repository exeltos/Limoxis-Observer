-- The patient registry isolation badge never showed in the cloud:
-- public.patient_infection_flags (20261128500100) returned resistance only
-- and the client set isolation: null. Each patient now also gets the active
-- isolation (status 'active' and not ended, as analysis_domain_metrics and the
-- surveillance record count it) of the most recent non-cancelled episode that
-- has one, with its precautions. The return type changes, so the old
-- function is set aside (renamed, no execute grant; drop it later) and the
-- new one created.

alter function public.patient_infection_flags(uuid) rename to patient_infection_flags_superseded;
revoke all on function public.patient_infection_flags_superseded(uuid) from public, anon, authenticated;

create function public.patient_infection_flags(p_organization_id uuid)
returns table (patient_id uuid, classification text, organism text, since timestamptz, isolated boolean, isolation_since timestamptz, isolation_precautions text[])
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with cases as (
    select c.id, c.patient_id, c.started_at
    from public.surveillance_cases c
    where c.organization_id = p_organization_id
      and c.patient_id is not null
      and c.status is distinct from 'cancelled'
  ),
  samples as materialized (
    select s.id, s.surveillance_case_id, s.requested_at,
           coalesce(nullif(amr.classification, ''), nullif(r.resistance_class, '')) as resistance,
           nullif(r.organism, '') as organism
    from public.laboratory_samples s
    join cases c on c.id = s.surveillance_case_id
    left join lateral (
      select m.id, m.resistance_class, m.organism
      from public.microbiology_results m
      where m.sample_id = s.id
      order by coalesce(m.validation_status = 'validated', false) desc, m.resulted_at desc, m.id
      limit 1
    ) r on true
    left join lateral (
      select x.classification
      from public.amr_classifications x
      where x.microbiology_result_id = r.id
      order by x.classified_at desc nulls last, x.id
      limit 1
    ) amr on true
  ),
  case_resistance as (
    select distinct on (s.surveillance_case_id) s.surveillance_case_id, s.resistance
    from samples s where s.resistance is not null
    order by s.surveillance_case_id, s.requested_at desc nulls last, s.id
  ),
  case_organism as (
    select distinct on (s.surveillance_case_id) s.surveillance_case_id, s.organism
    from samples s where s.organism is not null
    order by s.surveillance_case_id, s.requested_at desc nulls last, s.id
  ),
  resistant as (
    select distinct on (c.patient_id) c.patient_id, r.resistance, coalesce(o.organism, '') as organism, c.started_at
    from cases c
    join case_resistance r on r.surveillance_case_id = c.id
    left join case_organism o on o.surveillance_case_id = c.id
    order by c.patient_id, c.started_at desc, c.id
  ),
  isolated as (
    select distinct on (c.patient_id) c.patient_id, i.id, coalesce(i.started_at, c.started_at) as started_at
    from cases c
    join public.isolation_episodes i on i.surveillance_case_id = c.id
    where i.organization_id = p_organization_id and i.status = 'active' and i.ended_at is null
    order by c.patient_id, c.started_at desc, c.id, i.started_at desc nulls last, i.id
  )
  select coalesce(r.patient_id, i.patient_id), r.resistance, r.organism, r.started_at,
         i.patient_id is not null, i.started_at,
         case when i.id is null then null else coalesce((
           select array_agg(p.precaution order by p.position)
           from public.isolation_episode_precautions p
           where p.isolation_episode_id = i.id
         ), '{}') end
  from resistant r
  full join isolated i on i.patient_id = r.patient_id;
end;
$$;

revoke all on function public.patient_infection_flags(uuid) from public, anon;
grant execute on function public.patient_infection_flags(uuid) to authenticated;
