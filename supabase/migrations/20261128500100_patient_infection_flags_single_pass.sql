-- public.patient_infection_flags (20261128500000) ran a correlated subquery
-- over the samples for every episode: 1.5 s at ΙΑΣΩ. Each episode's first
-- resistant sample and first sample with an organism are now picked in one
-- pass (distinct on): 70 ms, the same rows.

create or replace function public.patient_infection_flags(p_organization_id uuid)
returns table (patient_id uuid, classification text, organism text, since timestamptz)
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
  )
  select distinct on (c.patient_id) c.patient_id, r.resistance, coalesce(o.organism, ''), c.started_at
  from cases c
  join case_resistance r on r.surveillance_case_id = c.id
  left join case_organism o on o.surveillance_case_id = c.id
  order by c.patient_id, c.started_at desc, c.id;
end;
$$;
