-- The registry's MDR flag also comes from a resistant result of a sample that was never
-- linked to a surveillance episode (not yet reviewed, or marked «no surveillance needed»):
-- before, only samples of an episode counted, so such a patient showed no flag.
-- The episodes keep precedence (same flag as before); the unlinked samples are read on
-- their own, so the function stays as fast (about 40 ms on the largest hospital).
-- Isolation still comes from the episodes' isolation records.

create or replace function public.patient_infection_flags(p_organization_id uuid)
returns table(patient_id uuid, classification text, organism text, since timestamp with time zone, isolated boolean, isolation_since timestamp with time zone, isolation_precautions text[])
language plpgsql
stable
set search_path to ''
set plan_cache_mode to 'force_custom_plan'
as $function$
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
  case_resistant as (
    select distinct on (c.patient_id) c.patient_id, r.resistance, coalesce(o.organism, '') as organism, c.started_at
    from cases c
    join case_resistance r on r.surveillance_case_id = c.id
    left join case_organism o on o.surveillance_case_id = c.id
    order by c.patient_id, c.started_at desc, c.id
  ),
  -- A resistant result of a sample with no episode: the latest one per patient.
  unlinked_resistant as (
    select distinct on (s.patient_id) s.patient_id,
           coalesce(nullif(amr.classification, ''), nullif(r.resistance_class, '')) as resistance,
           coalesce(nullif(r.organism, ''), '') as organism, s.requested_at as started_at
    from public.laboratory_samples s
    join lateral (
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
    where s.organization_id = p_organization_id
      and s.surveillance_case_id is null
      and s.patient_id is not null
      and coalesce(nullif(amr.classification, ''), nullif(r.resistance_class, '')) is not null
    order by s.patient_id, s.requested_at desc nulls last, s.id
  ),
  resistant as (
    select * from case_resistant
    union all
    select u.* from unlinked_resistant u
    where not exists (select 1 from case_resistant c where c.patient_id = u.patient_id)
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
$function$;
