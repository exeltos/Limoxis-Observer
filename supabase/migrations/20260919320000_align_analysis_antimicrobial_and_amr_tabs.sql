-- Analysis-page audit finding (P2): the Antimicrobials and AMR/MDR-XDR tabs
-- never caught up with fixes already made elsewhere this session.
--
-- Antimicrobials tab showed a single bare count of antimicrobial_therapies
-- rows, with no visibility into the approval_status/administrations split
-- added in 20260919290000 (a restricted antibiotic now sits 'pending' and
-- cannot be administered until approved) — the stewardship gate exists in
-- the database but is invisible in reporting.
--
-- AMR/MDR-XDR tab showed "positive results" (every positive microbiology
-- finding, any organism, any sample) and a raw sum of the resistance_class
-- breakdown — not the per-organism tested/resistant definition
-- private.indicator_metric_snapshot already uses for the real AMR
-- indicators (amr_tested_*/amr_resistant_*), which restricts to eight
-- named organisms tested against their own reference drug.
--
-- Fix: extend platform_report_summary's antimicrobial field into an object
-- (total/pending/administrations) instead of a bare count, and add a new
-- shared function, analysis_amr_susceptibility, reusing the exact
-- organism/reference-drug predicate from indicator_metric_snapshot
-- (20260919270000, lines 63-85) grouped by organism instead of flattened
-- into 16 individually-named columns.

create or replace function public.platform_report_summary(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare r jsonb;
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  select jsonb_build_object(
    'surveillance',(select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_department_id is null or s.department_id=p_department_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)),
    'laboratory',(select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_department_id is null or l.department_id=p_department_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)),
    'prevention',((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))),
    'controls',(select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_department_id is null or c.department_id=p_department_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
    'quality',((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))),
    'training',(select count(*) from public.training_records t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_department_id is null or t.department_id=p_department_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)),
    'documents',(select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_department_id is null or d.department_id=p_department_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)),
    'committees',(case when p_department_id is null then (select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)) else null end),
    'handHygiene',(select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'waste',(select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'antimicrobial',(case when p_department_id is null then jsonb_build_object(
        'total',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),
        'pending',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to) and a.approval_status='pending'),
        'administrations',(select count(*) from public.antimicrobial_therapy_administrations d join public.antimicrobial_therapies a on a.id=d.therapy_id where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or d.administered_at::date>=p_from) and (p_to is null or d.administered_at::date<=p_to) and d.status='administered')
      ) else null end),
    'occupationalHealth',(case when p_department_id is null and public.current_user_has_capability(p_organization_id,'view_occupational_health') then (select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to)) else null end)
  ) into r;
  return r;
end $function$;

grant execute on function public.platform_report_summary(uuid,date,date,uuid) to authenticated;

create or replace function public.analysis_amr_susceptibility(
  p_organization_id uuid,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns table (
  organism_group text,
  tested bigint,
  resistant bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with matched as (
    select
      case
        when lower(coalesce(a.organism,'')) like '%escherichia coli%' then 'Escherichia coli'
        when lower(coalesce(a.organism,'')) like '%proteus%' then 'Proteus spp.'
        when lower(coalesce(a.organism,'')) like '%acinetobacter%' then 'Acinetobacter spp.'
        when lower(coalesce(a.organism,'')) like '%klebsiella%' then 'Klebsiella spp.'
        when lower(coalesce(a.organism,'')) like '%enterobacter%' then 'Enterobacter spp.'
        when lower(coalesce(a.organism,'')) like '%pseudomonas%' then 'Pseudomonas aeruginosa'
        when lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' then 'Staphylococcus aureus'
        when lower(coalesce(a.organism,'')) like '%enterococcus%' then 'Enterococcus spp.'
      end as organism_group,
      (
        (lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%'))
        or (lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%'))
      ) as is_reference_drug,
      a.sir_category
    from antimicrobial_susceptibility_results a
    join microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
    join laboratory_samples l on l.id = m.sample_id
    where a.organization_id = p_organization_id
      and (p_department_id is null or l.department_id = p_department_id)
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and not exists (
        select 1 from microbiology_results m2
        where m2.organization_id = m.organization_id and m2.amended_from = m.id
      )
      and (p_from is null or l.collected_at::date >= p_from)
      and (p_to is null or l.collected_at::date <= p_to)
  )
  select organism_group, count(*) as tested, count(*) filter (where sir_category = 'R') as resistant
  from matched
  where organism_group is not null and is_reference_drug
  group by organism_group
  order by tested desc;
$function$;

grant execute on function public.analysis_amr_susceptibility(uuid, date, date, uuid) to authenticated;
