-- «Πίνακας Διοίκησης»: the Hospital Director (read-only) reads the hospital
-- through the same analysis RPCs as the Analysis page. Their role checks
-- listed Hospital Admin / IPC Lead only, so the director got
-- "access denied" on every section.
--
-- 1. The SECURITY DEFINER aggregates add 'hospital_director' to their role
--    array; the rest of the live body is kept (re-created from
--    pg_get_functiondef, as 20261125100100 does). Each raises if the array is
--    not found exactly once.
-- 2. Cluster detection (private) likewise.
-- 3. analysis_microbiology_findings / analysis_amr_susceptibility were
--    SECURITY INVOKER over laboratory RLS, which the director is not in. They
--    become SECURITY DEFINER with an explicit check of the same org-wide
--    laboratory readers plus the director (no rows for anyone else); only the
--    Analysis page and the Executive dashboard call them. Bodies unchanged.
-- 4. executive_governance_status: the committees' open decisions now, for the
--    dashboard's KPI strip (view_executive_dashboard).

do $do$
declare
  fn text;
  d text;
  hits int;
begin
  foreach fn in array array[
    'public.analysis_domain_metrics(uuid,date,date,uuid)',
    'public.analysis_crosstab_metrics(uuid,date,date,uuid)',
    'public.analysis_people_metrics(uuid,date,date,uuid)',
    'public.analysis_quality_food_metrics(uuid,date,date,uuid)',
    'public.platform_report_summary(uuid,date,date,uuid)'
  ] loop
    d := pg_get_functiondef(fn::regprocedure);
    if position('hospital_director' in d) > 0 then continue; end if;
    hits := (length(d) - length(replace(d, 'array[''hospital_admin'',''infection_control_lead''', ''))) / length('array[''hospital_admin'',''infection_control_lead''');
    if hits <> 1 then
      raise exception '%: role array not found exactly once (%)', fn, hits;
    end if;
    d := replace(d, 'array[''hospital_admin'',''infection_control_lead''', 'array[''hospital_admin'',''infection_control_lead'',''hospital_director''');
    execute d;
  end loop;

  d := pg_get_functiondef('private.detect_organism_clusters(uuid,integer,integer)'::regprocedure);
  if position('hospital_director' in d) = 0 then
    if position('array[''hospital_admin'',''infection_control_lead'',''infection_control_member'',''laboratory'',''doctor_reviewer'']' in d) = 0 then
      raise exception 'detect_organism_clusters: role array not found';
    end if;
    d := replace(d, 'array[''hospital_admin'',''infection_control_lead'',''infection_control_member'',''laboratory'',''doctor_reviewer'']', 'array[''hospital_admin'',''infection_control_lead'',''infection_control_member'',''laboratory'',''doctor_reviewer'',''hospital_director'']');
    execute d;
  end if;
end
$do$;

create or replace function public.analysis_microbiology_findings(p_organization_id uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns table(organization_id uuid, microbiology_result_id uuid, organism text, resistance_class text, is_critical boolean, department_id uuid, department_name text, source text, sample_type text, event_date date)
 language sql
 stable
 security definer
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
    and (select public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','hospital_director']::public.app_role[]))
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

create or replace function public.analysis_amr_susceptibility(p_organization_id uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns table(organism_group text, tested bigint, resistant bigint)
 language sql
 stable
 security definer
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
    join laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
    where a.organization_id = p_organization_id
      and (select public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','hospital_director']::public.app_role[]))
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and not exists (
        select 1 from microbiology_results m2
        where m2.organization_id = m.organization_id and m2.amended_from = m.id
      )
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

revoke all on function public.analysis_microbiology_findings(uuid, date, date, uuid) from public, anon;
grant execute on function public.analysis_microbiology_findings(uuid, date, date, uuid) to authenticated;
revoke all on function public.analysis_amr_susceptibility(uuid, date, date, uuid) from public, anon;
grant execute on function public.analysis_amr_susceptibility(uuid, date, date, uuid) to authenticated;

create or replace function public.executive_governance_status(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.current_user_has_capability(p_organization_id, 'view_executive_dashboard') then jsonb_build_object(
    'openDecisions', (select count(*) from public.committee_decisions x where x.organization_id = p_organization_id and coalesce(x.status, '') not in ('completed', 'closed', 'cancelled')),
    'overdueDecisions', (select count(*) from public.committee_decisions x where x.organization_id = p_organization_id and coalesce(x.status, '') not in ('completed', 'closed', 'cancelled') and x.due_date < current_date)
  ) end
$$;

revoke all on function public.executive_governance_status(uuid) from public, anon;
grant execute on function public.executive_governance_status(uuid) to authenticated;
