-- «Μικρόβιο / απομόνωση» in the patients list (owner, 19/11/2026): every patient's latest organism from a positive
-- culture, not only the resistant ones. patient_infection_flags keeps its shape (its result columns cannot change
-- without dropping it), so the latest organism is a read of its own, run beside it.
-- SECURITY INVOKER: the caller's RLS on laboratory_samples and microbiology_results decides what is read; the
-- organization is also filtered explicitly. Same lookup of a sample's result as patient_infection_flags.

create or replace function public.patient_latest_organisms(p_organization_id uuid)
returns table(patient_id uuid, organism text, resistance text, resulted_at timestamp with time zone)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $function$
#variable_conflict use_column
begin
  return query
  select distinct on (s.patient_id) s.patient_id, r.organism,
         coalesce(nullif(amr.classification, ''), nullif(r.resistance_class, '')),
         coalesce(r.resulted_at, s.requested_at)
  from public.laboratory_samples s
  join lateral (
    select m.id, m.resistance_class, nullif(m.organism, '') as organism, m.resulted_at
    from public.microbiology_results m
    where m.sample_id = s.id and nullif(m.organism, '') is not null
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
    and s.patient_id is not null
  order by s.patient_id, coalesce(r.resulted_at, s.requested_at) desc nulls last, s.id;
end;
$function$;

revoke all on function public.patient_latest_organisms(uuid) from public, anon;
grant execute on function public.patient_latest_organisms(uuid) to authenticated;
