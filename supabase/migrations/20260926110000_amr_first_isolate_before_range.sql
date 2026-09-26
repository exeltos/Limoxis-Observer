-- analysis_amr_susceptibility: find the first isolate per patient, organism
-- group and calendar year over the whole year (hospital-wide), then apply the
-- requested period and department. Before, a month/quarter range or a
-- department filter could drop the true first isolate and count a later
-- repeat isolate as the first.

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
      a.sir_category,
      coalesce(l.patient_id::text, 'sample:' || l.id::text) as patient_key,
      l.collected_at,
      l.department_id,
      l.id as sample_id
    from antimicrobial_susceptibility_results a
    join microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
    join laboratory_samples l on l.id = m.sample_id
    where a.organization_id = p_organization_id
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and not exists (
        select 1 from microbiology_results m2
        where m2.organization_id = m.organization_id and m2.amended_from = m.id
      )
      -- whole calendar years around the requested range, so the first isolate
      -- of the year is found even when it falls before the range starts
      and (p_from is null or l.collected_at >= date_trunc('year', p_from::timestamp))
      and (p_to is null or l.collected_at < date_trunc('year', p_to::timestamp) + interval '1 year')
  ),
  first_isolates as (
    select distinct on (patient_key, organism_group, extract(year from collected_at))
      organism_group, sir_category, collected_at, department_id
    from matched
    where organism_group is not null and is_reference_drug
    order by patient_key, organism_group, extract(year from collected_at), collected_at, sample_id
  )
  select organism_group, count(*) as tested, count(*) filter (where sir_category = 'R') as resistant
  from first_isolates
  where (p_from is null or collected_at::date >= p_from)
    and (p_to is null or collected_at::date <= p_to)
    and (p_department_id is null or department_id = p_department_id)
  group by organism_group
  order by tested desc;
$function$;
