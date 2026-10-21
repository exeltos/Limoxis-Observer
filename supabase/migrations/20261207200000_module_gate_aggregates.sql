-- Locked modules in the aggregated (SECURITY DEFINER) reads.
-- 20261201200000 closed the module tables for direct reads with restrictive
-- <table>_module_gate policies. SECURITY DEFINER functions run as the owner and skip RLS, so
-- the analysis / executive aggregates still counted rows of a locked module. Each function
-- below now decides by the same rule as the gates: the Platform Owner is never locked; a
-- group of modules counts as locked when every module of the group is locked
-- (private.org_disabled_modules). A locked part comes back as zero / empty, so the pages keep
-- working (they already hide locked sections through moduleEnabled). Unlocked modules return
-- exactly what they returned before. Same signatures, same grants; nothing is dropped.
-- INVOKER functions (dashboard_metrics, control_*, kitchen_batch_balances, ...) obey RLS and
-- the gates already; see docs/MODULE_GATE_AGGREGATES.md.

create or replace function private.org_modules_locked(target_org uuid, p_modules text[])
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select target_org is not null
    and not coalesce(public.current_user_is_platform_owner(), false)
    and p_modules <@ private.org_disabled_modules(target_org)
$function$;

-- Analytics: AMR first isolates (laboratory samples / microbiology; analysis module) -------------
create or replace function public.analysis_amr_susceptibility(p_organization_id uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns table(organism_group text, tested bigint, resistant bigint)
 language sql
 stable security definer
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
      and not (select private.org_modules_locked(p_organization_id, array['analysis']) or private.org_modules_locked(p_organization_id, array['laboratory','surveillance']))
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

-- Analytics: positive-culture findings ---------------------------------------------------------------
create or replace function public.analysis_microbiology_findings(p_organization_id uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns table(organization_id uuid, microbiology_result_id uuid, organism text, resistance_class text, is_critical boolean, department_id uuid, department_name text, source text, sample_type text, event_date date)
 language sql
 stable security definer
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
    and not (select private.org_modules_locked(p_organization_id, array['analysis']) or private.org_modules_locked(p_organization_id, array['laboratory','surveillance']))
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

-- Executive: open / overdue committee decisions (governance) -----------------------------------------
create or replace function public.executive_governance_status(p_organization_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when public.current_user_has_capability(p_organization_id, 'view_executive_dashboard') and not private.org_modules_locked(p_organization_id, array['governance']) then jsonb_build_object(
    'openDecisions', (select count(*) from public.committee_decisions x where x.organization_id = p_organization_id and coalesce(x.status, '') not in ('completed', 'closed', 'cancelled')),
    'overdueDecisions', (select count(*) from public.committee_decisions x where x.organization_id = p_organization_id and coalesce(x.status, '') not in ('completed', 'closed', 'cancelled') and x.due_date < current_date)
  ) end
$function$;

-- Controlled documents: read-acknowledgement audience (governance) -----------------------------------
create or replace function public.document_acknowledgement_members(p_organization_id uuid)
 returns table(user_id uuid, full_name text, member_role text, department_ids uuid[], profession text, profession_en text, employee_department text, employee_department_en text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    om.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '') as full_name,
    om.role::text as member_role,
    coalesce((select array_agg(oms.department_id) from public.organization_member_scopes oms where oms.membership_id = om.id and oms.department_id is not null), '{}'::uuid[]) as department_ids,
    e.profession_name as profession,
    e.profession_name_en as profession_en,
    e.department_name as employee_department,
    e.department_name_en as employee_department_en
  from public.organization_members om
  left join public.profiles p on p.id = om.user_id
  left join lateral (
    select emp.profession_name, emp.profession_name_en, emp.department_name, emp.department_name_en
    from public.employees emp
    where emp.organization_id = om.organization_id and emp.user_id = om.user_id
    order by emp.updated_at desc nulls last
    limit 1
  ) e on true
  where om.organization_id = p_organization_id
    and om.status = 'active'
    and not private.org_modules_locked(p_organization_id, array['governance'])
    and (
      public.is_org_admin(p_organization_id)
      or public.current_user_has_org_role(p_organization_id, array['infection_control_lead'::public.app_role, 'quality_manager'::public.app_role])
    );
$function$;

-- Report summary (Analysis > Reporting) --------------------------------------------------------------
create or replace function public.platform_report_summary(p_organization_id uuid default null::uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  r jsonb;
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_surv boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance']);
  l_lab boolean := l_all or private.org_modules_locked(p_organization_id, array['laboratory','surveillance']);
  l_prev boolean := l_all or private.org_modules_locked(p_organization_id, array['prevention']);
  l_ctrl boolean := l_all or private.org_modules_locked(p_organization_id, array['controls']);
  l_qual boolean := l_all or private.org_modules_locked(p_organization_id, array['quality']);
  l_gov boolean := l_all or private.org_modules_locked(p_organization_id, array['governance']);
  l_am boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance','pharmacy']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  select jsonb_build_object(
    'surveillance',case when l_surv then 0 else (select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_department_id is null or s.department_id=p_department_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)) end,
    'laboratory',case when l_lab then 0 else (select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_department_id is null or l.department_id=p_department_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)) end,
    'prevention',case when l_prev then 0 else ((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))) end,
    'controls',case when l_ctrl then 0 else (select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_department_id is null or c.department_id=p_department_id) and (p_from is null or c.created_at>=p_from::timestamptz) and (p_to is null or c.created_at<(p_to+1)::timestamptz)) end,
    'quality',case when l_qual then 0 else ((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))) end,
    'training',case when l_all then 0 else (select count(*) from public.training_assignments t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_department_id is null or t.department_id=p_department_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)) end,
    'documents',case when l_gov then 0 else (select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_department_id is null or d.department_id=p_department_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)) end,
    'committees',(case when p_department_id is null then (case when l_gov then 0 else (select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at>=p_from::timestamptz) and (p_to is null or c.created_at<(p_to+1)::timestamptz)) end) else null end),
    'handHygiene',case when l_prev then 0 else (select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) end,
    'waste',case when l_prev then 0 else (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) end,
    'antimicrobial',(case when p_department_id is null then (case when l_am then jsonb_build_object('total',0,'pending',0,'administrations',0) else jsonb_build_object(
        'total',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),
        'pending',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to) and a.approval_status='pending'),
        'administrations',(select count(*) from public.antimicrobial_therapy_administrations d join public.antimicrobial_therapies a on a.id=d.therapy_id where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or d.administered_at::date>=p_from) and (p_to is null or d.administered_at::date<=p_to) and d.status='administered')
      ) end) else null end),
    'occupationalHealth',(case when p_department_id is null and public.current_user_has_capability(p_organization_id,'view_occupational_health') then (select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to)) else null end)
  ) into r;
  return r;
end $function$;

-- Analysis > Staff -----------------------------------------------------------------------------------
create or replace function public.analysis_people_metrics(p_organization_id uuid default null::uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  r jsonb;
  can_health boolean := p_organization_id is not null and public.current_user_has_capability(p_organization_id,'view_occupational_health');
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_gov boolean := l_all or private.org_modules_locked(p_organization_id, array['governance']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;
  can_health := can_health and not l_all;

  with
  emp as (
    select e.* from public.employees e
    where not l_all
      and (p_organization_id is null or e.organization_id=p_organization_id)
      and (p_department_id is null or e.department_id=p_department_id)
      and coalesce(e.employment_status,'active')='active'
  ),
  vac as (
    select v.* from public.employee_vaccinations v join emp on emp.id=v.employee_id
    where coalesce(v.status,'') not in ('cancelled','void','voided')
      and (v.valid_until is null or v.valid_until>=current_date)
  ),
  ohv as (
    select o.* from public.occupational_health_visits o join emp on emp.id=o.employee_id
    where (p_from is null or coalesce(o.visit_date,o.created_at::date)>=p_from)
      and (p_to is null or coalesce(o.visit_date,o.created_at::date)<=p_to)
  ),
  tra as (
    select t.status, t.due_date, t.score, t.department_name, t.department_id from public.training_assignments t
    where not l_all
      and (p_organization_id is null or t.organization_id=p_organization_id)
      and (p_department_id is null or t.department_id=p_department_id)
      and (p_from is null or coalesce(t.assigned_date,t.created_at::date)>=p_from)
      and (p_to is null or coalesce(t.assigned_date,t.created_at::date)<=p_to)
  ),
  doc as (
    select d.* from public.controlled_documents d
    where not l_gov
      and (p_organization_id is null or d.organization_id=p_organization_id)
      and (p_department_id is null or d.department_id=p_department_id)
      and coalesce(d.status,'') not in ('archived','superseded','void','voided')
  ),
  mtg as (
    select m.* from public.committee_meetings m
    where not l_gov
      and p_department_id is null
      and (p_organization_id is null or m.organization_id=p_organization_id)
      and (p_from is null or m.scheduled_at::date>=p_from)
      and (p_to is null or m.scheduled_at::date<=p_to)
  ),
  dept as (select id,name from public.departments)
  select jsonb_build_object(
    'workforce', jsonb_build_object(
      'activeEmployees',(select count(*) from emp),
      'vaccinatedEmployees',case when can_health then (select count(distinct employee_id) from vac) else null end,
      'byVaccine',case when can_health then coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(vaccine_label_snapshot,'—') k,count(distinct employee_id) n from vac group by 1) x),'[]'::jsonb) else null end,
      'visits',case when can_health then (select count(*) from ohv) else null end,
      'byVisitType',case when can_health then coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(visit_type,'—') k,count(*) n from ohv group by 1) x),'[]'::jsonb) else null end,
      'followUpsDue',case when can_health then (select count(*) from public.occupational_health_visits o join emp on emp.id=o.employee_id where o.follow_up_date<current_date and coalesce(o.status,'') not in ('cancelled')) else null end,
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(d.name,emp.department_name,'—') k,count(*) n from emp left join dept d on d.id=emp.department_id group by 1) x),'[]'::jsonb)
    ),
    'training', jsonb_build_object(
      'assignments',(select count(*) from tra),
      'completed',(select count(*) from tra where status='completed'),
      'overdue',(select count(*) from tra where status not in ('completed','cancelled') and due_date<current_date),
      'averageScore',(select round(avg(score::numeric),1) from tra where score is not null),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,c) order by n desc) from (select coalesce(d.name,tra.department_name,'—') k,count(*) n,count(*) filter (where tra.status='completed') c from tra left join dept d on d.id=tra.department_id group by 1) x),'[]'::jsonb)
    ),
    'governance', jsonb_build_object(
      'documents',(select count(*) from doc),
      'published',(select count(*) from doc where status in ('published','approved')),
      'reviewOverdue',(select count(*) from doc where status in ('published','approved') and review_date<current_date),
      'byType',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(document_type,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'byStatus',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(status,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'committees',case when p_department_id is null then (select count(*) from public.committees c where not l_gov and (p_organization_id is null or c.organization_id=p_organization_id) and coalesce(c.status,'active')='active') else null end,
      'meetings',(select count(*) from mtg where cancelled_at is null),
      'minutesFinalized',(select count(*) from mtg where finalized_at is not null),
      'minutesPending',(select count(*) from mtg where cancelled_at is null and finalized_at is null and scheduled_at<now())
    )
  ) into r;
  return r;
end $function$;

-- Analysis > Surveillance / Prevention / Controls / Quality / Antimicrobial --------------------------
create or replace function public.analysis_domain_metrics(p_organization_id uuid default null::uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  r jsonb;
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_surv boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance']);
  l_prev boolean := l_all or private.org_modules_locked(p_organization_id, array['prevention']);
  l_ctrl boolean := l_all or private.org_modules_locked(p_organization_id, array['controls']);
  l_qual boolean := l_all or private.org_modules_locked(p_organization_id, array['quality']);
  l_am boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance','pharmacy']);
  l_dev boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance','prevention']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  with
  sc as (
    select s.* from public.surveillance_cases s
    where not l_surv
      and (p_organization_id is null or s.organization_id=p_organization_id)
      and (p_department_id is null or s.department_id=p_department_id)
      and s.voided_at is null and coalesce(s.status,'') <> 'cancelled'
      and (p_from is null or coalesce(s.started_at,s.created_at)::date>=p_from)
      and (p_to is null or coalesce(s.started_at,s.created_at)::date<=p_to)
  ),
  hai as (
    select distinct on (h.surveillance_case_id) h.* from public.hai_classifications h
    join sc on sc.id=h.surveillance_case_id
    order by h.surveillance_case_id, h.classified_at desc nulls last, h.created_at desc
  ),
  hh as (
    select h.* from public.hand_hygiene_sessions h
    where not l_prev
      and (p_organization_id is null or h.organization_id=p_organization_id)
      and (p_department_id is null or h.department_id=p_department_id)
      and coalesce(h.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(h.observation_date,h.created_at::date)>=p_from)
      and (p_to is null or coalesce(h.observation_date,h.created_at::date)<=p_to)
  ),
  pb as (
    select b.* from public.prevention_bundle_assessments b
    where not l_prev
      and (p_organization_id is null or b.organization_id=p_organization_id)
      and (p_department_id is null or b.department_id=p_department_id)
      and coalesce(b.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(b.assessment_date,b.created_at::date)>=p_from)
      and (p_to is null or coalesce(b.assessment_date,b.created_at::date)<=p_to)
  ),
  wm as (
    select w.* from public.waste_measurements w
    where not l_prev
      and (p_organization_id is null or w.organization_id=p_organization_id)
      and (p_department_id is null or w.department_id=p_department_id)
      and coalesce(w.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(w.record_date,w.created_at::date)>=p_from)
      and (p_to is null or coalesce(w.record_date,w.created_at::date)<=p_to)
  ),
  ce as (
    select c.department_id, c.control_id, c.status, c.has_finding, c.performed_at, c.created_at from public.control_executions c
    where not l_ctrl
      and (p_organization_id is null or c.organization_id=p_organization_id)
      and (p_department_id is null or c.department_id=p_department_id)
      and c.cancelled_at is null
      and (p_from is null or c.performed_at>=p_from)
      and (p_to is null or c.performed_at<p_to+1)
  ),
  qi as (
    select q.* from public.quality_incidents q
    where not l_qual
      and (p_organization_id is null or q.organization_id=p_organization_id)
      and (p_department_id is null or q.department_id=p_department_id)
      and q.voided_at is null
      and (p_from is null or coalesce(q.occurred_at,q.created_at)::date>=p_from)
      and (p_to is null or coalesce(q.occurred_at,q.created_at)::date<=p_to)
  ),
  qc as (
    select q.* from public.quality_capa_actions q
    where not l_qual
      and (p_organization_id is null or q.organization_id=p_organization_id)
      and (p_department_id is null or q.department_id=p_department_id)
      and q.voided_at is null
  ),
  am as (
    select a.* from public.antimicrobial_therapies a
    where not l_am
      and (p_organization_id is null or a.organization_id=p_organization_id)
      and (p_from is null or coalesce(a.started_at,a.created_at)::date>=p_from)
      and (p_to is null or coalesce(a.started_at,a.created_at)::date<=p_to)
  ),
  iso as (
    select i.* from public.isolation_episodes i
    where not l_surv
      and (p_organization_id is null or i.organization_id=p_organization_id)
      and (p_department_id is null or i.department_id=p_department_id)
  ),
  dev as (
    select d.* from public.surveillance_devices d
    where not l_dev
      and (p_organization_id is null or d.organization_id=p_organization_id)
      and (p_department_id is null or d.department_id=p_department_id)
  ),
  dept as (select id,name from public.departments)
  select jsonb_build_object(
    'surveillance', jsonb_build_object(
      'total',(select count(*) from sc),
      'active',(select count(*) from sc where status='active'),
      'closed',(select count(*) from sc where status in ('closed','completed')),
      'haiConfirmed',(select count(*) from hai where case_status='confirmed'),
      'haiProbable',(select count(*) from hai where case_status in ('probable','suspected')),
      'byHaiType',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(hai_type,'—') k,count(*) n from hai group by 1) x),'[]'::jsonb),
      'byCaseStatus',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(case_status,'—') k,count(*) n from hai group by 1) x),'[]'::jsonb),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(d.name,'—') k,count(*) n from sc left join dept d on d.id=sc.department_id group by 1) x),'[]'::jsonb),
      'monthly',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by k) from (select to_char(coalesce(started_at,created_at),'YYYY-MM') k,count(*) n from sc group by 1) x),'[]'::jsonb),
      'outcomes',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(o.outcome,'—') k,count(*) n from public.surveillance_outcomes o join sc on sc.id=o.surveillance_case_id group by 1) x),'[]'::jsonb),
      'isolationActive',(select count(*) from iso where status='active'),
      'isolationReviewOverdue',(select count(*) from iso where status='active' and review_due_at<now()),
      'devicesActive',(select count(*) from dev where removed_at is null and coalesce(status,'active')='active'),
      'byDevice',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(device_type,'—') k,count(*) n from dev where removed_at is null group by 1) x),'[]'::jsonb)
    ),
    'handHygiene', jsonb_build_object(
      'sessions',(select count(*) from hh),
      'observations',(select coalesce(sum(observations),0) from hh),
      'compliant',(select coalesce(sum(compliant_observations),0) from hh),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,o,c) order by o desc) from (select coalesce(d.name,'—') k,sum(observations) o,sum(compliant_observations) c from hh left join dept d on d.id=hh.department_id group by 1) x),'[]'::jsonb),
      'byCategory',coalesce((select jsonb_agg(jsonb_build_array(k,o,c) order by o desc) from (select coalesce(professional_category,'—') k,sum(observations) o,sum(compliant_observations) c from hh group by 1) x),'[]'::jsonb),
      'monthly',coalesce((select jsonb_agg(jsonb_build_array(k,o,c) order by k) from (select to_char(coalesce(observation_date,created_at::date),'YYYY-MM') k,sum(observations) o,sum(compliant_observations) c from hh group by 1) x),'[]'::jsonb)
    ),
    'bundles', jsonb_build_object(
      'assessments',(select count(*) from pb),
      'averageScore',(select round(avg(score)::numeric,1) from pb where score is not null),
      'byBundle',coalesce((select jsonb_agg(jsonb_build_array(k,n,s) order by n desc) from (select coalesce(bundle_key,'—') k,count(*) n,round(avg(score)::numeric,1) s from pb group by 1) x),'[]'::jsonb),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,s) order by s desc nulls last) from (select coalesce(d.name,'—') k,count(*) n,round(avg(score)::numeric,1) s from pb left join dept d on d.id=pb.department_id group by 1) x),'[]'::jsonb)
    ),
    'waste', jsonb_build_object(
      'records',(select count(*) from wm),
      'totalKg',(select coalesce(round(sum(weight_kg)::numeric,1),0) from wm),
      'patientDays',(select coalesce(sum(patient_days),0) from wm),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,kg) order by kg desc) from (select coalesce(d.name,'—') k,round(sum(weight_kg)::numeric,1) kg from wm left join dept d on d.id=wm.department_id group by 1) x),'[]'::jsonb)
    ),
    'controls', jsonb_build_object(
      'executions',(select count(*) from ce),
      'completed',(select count(*) from ce where status='completed'),
      'withFinding',(select count(*) from ce where has_finding),
      'overdueAssignments',(select count(*) from public.control_assignments a where not l_ctrl and (p_organization_id is null or a.organization_id=p_organization_id) and (p_department_id is null or a.department_id=p_department_id) and coalesce(a.status,'active')='active' and a.next_due_at<now()),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,f) order by n desc) from (select coalesce(d.name,'—') k,count(*) n,count(*) filter (where has_finding) f from ce left join dept d on d.id=ce.department_id group by 1) x),'[]'::jsonb)
    ),
    'quality', jsonb_build_object(
      'incidents',(select count(*) from qi),
      'openIncidents',(select count(*) from qi where coalesce(status,'') not in ('closed','resolved','completed')),
      'harm',(select count(*) from qi where harm_occurred),
      'bySeverity',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(severity,'—') k,count(*) n from qi group by 1) x),'[]'::jsonb),
      'byStatus',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(status,'—') k,count(*) n from qi group by 1) x),'[]'::jsonb),
      'capaOpen',(select count(*) from qc where coalesce(status,'') not in ('closed','completed','verified')),
      'capaOverdue',(select count(*) from qc where coalesce(status,'') not in ('closed','completed','verified') and due_date<current_date)
    ),
    'antimicrobial', case when p_department_id is null then jsonb_build_object(
      'total',(select count(*) from am),
      'active',(select count(*) from am where coalesce(status,'active')='active' and ended_at is null),
      'pending',(select count(*) from am where approval_status='pending'),
      'byAgent',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(antimicrobial,'—') k,count(*) n from am group by 1 order by 2 desc limit 10) x),'[]'::jsonb),
      'byApproval',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(approval_status,'—') k,count(*) n from am group by 1) x),'[]'::jsonb)
    ) else null end
  ) into r;
  return r;
end $function$;

-- Analysis > Cross-tabulations -----------------------------------------------------------------------
create or replace function public.analysis_crosstab_metrics(p_organization_id uuid default null::uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_surv boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance']);
  l_ctrl boolean := l_all or private.org_modules_locked(p_organization_id, array['controls']);
  l_qual boolean := l_all or private.org_modules_locked(p_organization_id, array['quality']);
  l_am boolean := l_all or private.org_modules_locked(p_organization_id, array['surveillance','pharmacy']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  with
  sc as (
    select s.* from public.surveillance_cases s
    where not l_surv
      and (p_organization_id is null or s.organization_id = p_organization_id)
      and (p_department_id is null or s.department_id = p_department_id)
      and s.voided_at is null and coalesce(s.status, '') <> 'cancelled'
      and (p_from is null or coalesce(s.started_at, s.created_at)::date >= p_from)
      and (p_to is null or coalesce(s.started_at, s.created_at)::date <= p_to)
  ),
  dept as (select id, name from public.departments),
  hai as (
    select distinct on (h.surveillance_case_id) h.*, sc.department_id
    from public.hai_classifications h
    join sc on sc.id = h.surveillance_case_id
    order by h.surveillance_case_id, h.classified_at desc nulls last, h.created_at desc
  ),
  org as (
    select distinct on (ls.surveillance_case_id) ls.surveillance_case_id, btrim(m.organism) organism
    from public.laboratory_samples ls
    join sc on sc.id = ls.surveillance_case_id
    join public.microbiology_results m on m.sample_id = ls.id
    where coalesce(btrim(m.organism), '') <> ''
      and m.validation_status in ('validated', 'amended')
      and not exists (select 1 from public.microbiology_results m2 where m2.amended_from = m.id)
    order by ls.surveillance_case_id, coalesce(m.validated_at, m.resulted_at, m.created_at) desc
  ),
  dai as (
    select hai.department_id,
      case
        when hai.hai_type ilike 'CLABSI%' then 'CLABSI'
        when hai.hai_type ilike 'CAUTI%' then 'CAUTI'
        when hai.hai_type ilike 'VAP%' then 'VAP'
        when hai.hai_type = 'bloodstreamInfection' and exists (select 1 from public.surveillance_devices d where d.surveillance_case_id = hai.surveillance_case_id and d.device_type ~* '(central|cvc|picc|κεντρικ)') then 'CLABSI'
        when hai.hai_type = 'urinaryTractInfection' and exists (select 1 from public.surveillance_devices d where d.surveillance_case_id = hai.surveillance_case_id and d.device_type ~* '(urinary|foley|ουροκαθ)') then 'CAUTI'
        when hai.hai_type in ('pneumonia', 'ventilatorAssociatedPneumonia') and exists (select 1 from public.surveillance_devices d where d.surveillance_case_id = hai.surveillance_case_id and d.device_type ~* '(endotracheal|ventilat|tracheost|ενδοτραχ|αναπνευστ|τραχειοστ)') then 'VAP'
      end kind
    from hai
  ),
  am as (
    select a.*, sc.department_id case_department_id
    from public.antimicrobial_therapies a
    left join public.surveillance_cases sc on sc.id = a.surveillance_case_id
    where not l_am
      and (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_department_id is null or sc.department_id = p_department_id)
      and (p_from is null or coalesce(a.started_at, a.created_at)::date >= p_from)
      and (p_to is null or coalesce(a.started_at, a.created_at)::date <= p_to)
  ),
  ce as (
    select c.department_id, c.control_id, c.status, c.has_finding, c.performed_at, c.created_at from public.control_executions c
    where not l_ctrl
      and (p_organization_id is null or c.organization_id = p_organization_id)
      and (p_department_id is null or c.department_id = p_department_id)
      and c.cancelled_at is null
      and (p_from is null or c.performed_at >= p_from)
      and (p_to is null or c.performed_at < p_to + 1)
  ),
  qi as (
    select q.* from public.quality_incidents q
    where not l_qual
      and (p_organization_id is null or q.organization_id = p_organization_id)
      and (p_department_id is null or q.department_id = p_department_id)
      and q.voided_at is null
      and (p_from is null or coalesce(q.occurred_at, q.created_at)::date >= p_from)
      and (p_to is null or coalesce(q.occurred_at, q.created_at)::date <= p_to)
  )
  select jsonb_build_object(
    'surveillance', jsonb_build_object(
      'haiByDepartment', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(d.name, '—') r, coalesce(hai.hai_type, '—') c, count(*) n
        from hai left join dept d on d.id = hai.department_id group by 1, 2) x), '[]'::jsonb),
      'organismByHaiType', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select org.organism r, coalesce(hai.hai_type, '—') c, count(*) n
        from hai join org on org.surveillance_case_id = hai.surveillance_case_id group by 1, 2) x), '[]'::jsonb),
      'deviceAssociated', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(d.name, '—') r, dai.kind c, count(*) n
        from dai left join dept d on d.id = dai.department_id where dai.kind is not null group by 1, 2) x), '[]'::jsonb)
    ),
    'antimicrobial', jsonb_build_object(
      'byAgentDepartment', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(am.antimicrobial, '—') r, coalesce(d.name, '—') c, count(*) n
        from am left join dept d on d.id = am.case_department_id group by 1, 2) x), '[]'::jsonb),
      'byAgentOrganism', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(am.antimicrobial, '—') r, org.organism c, count(*) n
        from am join org on org.surveillance_case_id = am.surveillance_case_id group by 1, 2) x), '[]'::jsonb)
    ),
    'controls', jsonb_build_object(
      'monthly', coalesce((select jsonb_agg(jsonb_build_array(k, n) order by k) from (
        select to_char(coalesce(performed_at, created_at), 'YYYY-MM') k, count(*) n from ce group by 1) x), '[]'::jsonb),
      'findingsByControl', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(cd.title, '—') r, coalesce(d.name, '—') c, count(*) n
        from ce left join public.control_definitions cd on cd.id = ce.control_id left join dept d on d.id = ce.department_id
        where ce.has_finding group by 1, 2) x), '[]'::jsonb)
    ),
    'quality', jsonb_build_object(
      'monthly', coalesce((select jsonb_agg(jsonb_build_array(k, n) order by k) from (
        select to_char(coalesce(occurred_at, created_at), 'YYYY-MM') k, count(*) n from qi group by 1) x), '[]'::jsonb),
      'severityByDepartment', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (
        select coalesce(d.name, '—') r, coalesce(qi.severity, '—') c, count(*) n
        from qi left join dept d on d.id = qi.department_id group by 1, 2) x), '[]'::jsonb)
    )
  ) into v_result;
  return v_result;
end $function$;

-- Analysis > Quality & food safety (audits, suppliers, kitchen, surveys, risks) -----------------------
create or replace function public.analysis_quality_food_metrics(p_organization_id uuid default null::uuid, p_from date default null::date, p_to date default null::date, p_department_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_today date := current_date;
  v_audits jsonb;
  v_suppliers jsonb;
  v_kitchen jsonb;
  v_surveys jsonb;
  v_risks jsonb;
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_qual boolean := l_all or private.org_modules_locked(p_organization_id, array['quality']);
  l_sup boolean := l_qual or private.org_modules_locked(p_organization_id, array['suppliers']);
  l_kit boolean := l_all or private.org_modules_locked(p_organization_id, array['kitchen']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director','quality_manager']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  with au as (
    select a.id, coalesce(a.standard, 'other') as standard
    from public.quality_audits a
    where not l_qual
      and (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_department_id is null or a.department_id = p_department_id)
      and a.status = 'completed' and a.voided_at is null
      and (p_from is null or a.completed_date >= p_from)
      and (p_to is null or a.completed_date <= p_to)
  ),
  ans as (
    select au.standard, coalesce(i.result, i.answer) as result
    from au
    join public.quality_audit_checklist_items i on i.audit_id = au.id
    where coalesce(i.result, i.answer) in ('yes', 'partial', 'no')
  ),
  st as (
    select ans.standard, count(*) as applicable, count(*) filter (where ans.result = 'yes') as compliant
    from ans group by ans.standard
  ),
  fo as (
    select coalesce(f.finding_class, 'unclassified') as finding_class
    from public.quality_findings f
    where not l_qual
      and (p_organization_id is null or f.organization_id = p_organization_id)
      and (p_department_id is null or f.department_id = p_department_id)
      and f.source_type = 'audit' and f.status <> 'closed' and f.voided_at is null
  )
  select jsonb_build_object(
    'audits', (select count(*) from au),
    'auditsPlanned', (
      select count(*) from public.quality_audits a
      where not l_qual
        and (p_organization_id is null or a.organization_id = p_organization_id)
        and (p_department_id is null or a.department_id = p_department_id)
        and a.status in ('planned', 'in_progress') and a.voided_at is null
        and (p_from is null or a.planned_date >= p_from)
        and (p_to is null or a.planned_date <= p_to)),
    'answersApplicable', coalesce((select sum(st.applicable) from st), 0),
    'answersCompliant', coalesce((select sum(st.compliant) from st), 0),
    'byStandard', coalesce((select jsonb_agg(jsonb_build_array(st.standard, st.applicable, st.compliant) order by st.applicable desc, st.standard) from st), '[]'::jsonb),
    'findingsOpen', (select count(*) from fo),
    'findingsMajor', (select count(*) from fo where fo.finding_class = 'major'),
    'findingsByClass', coalesce((select jsonb_agg(jsonb_build_array(x.finding_class, x.n) order by x.n desc, x.finding_class) from (select fo.finding_class, count(*) as n from fo group by fo.finding_class) x), '[]'::jsonb)
  ) into v_audits;

  with sp as (
    select s.id from public.quality_suppliers s
    where not l_sup
      and (p_organization_id is null or s.organization_id = p_organization_id) and s.status = 'active'
  ),
  ev as (
    select e.supplier_id, e.pass_threshold, e.conditional_threshold,
      coalesce(e.total_score, (
        select round(100 * sum(sc.score::numeric / sc.score_scale * sc.weight) / nullif(sum(sc.weight), 0), 1)
        from public.quality_supplier_evaluation_scores sc
        where sc.evaluation_id = e.id and sc.organization_id = e.organization_id)) as score
    from public.quality_supplier_evaluations e
    join sp on sp.id = e.supplier_id
    where (p_from is null or e.evaluated_on >= p_from) and (p_to is null or e.evaluated_on <= p_to)
  ),
  sc as (
    select ev.supplier_id, ev.score,
      case when ev.score >= coalesce(ev.pass_threshold, 80) then 'approved'
           when ev.score >= coalesce(ev.conditional_threshold, 60) then 'conditional'
           else 'rejected' end as outcome
    from ev where ev.score is not null
  ),
  ce as (
    select c.expires_on from public.quality_supplier_certifications c
    join sp on sp.id = c.supplier_id
    where c.expires_on is not null and c.expires_on <= v_today + 60
  ),
  nc as (
    select n.occurred_on, n.status from public.quality_supplier_nonconformities n
    join sp on sp.id = n.supplier_id
  )
  select jsonb_build_object(
    'suppliersActive', (select count(*) from sp),
    'suppliersEvaluated', (select count(distinct sc.supplier_id) from sc),
    'evaluations', (select count(*) from sc),
    'evaluationScoreTotal', coalesce((select round(sum(sc.score), 1) from sc), 0),
    'evaluationsByResult', coalesce((select jsonb_agg(jsonb_build_array(x.outcome, x.n) order by x.n desc, x.outcome) from (select sc.outcome, count(*) as n from sc group by sc.outcome) x), '[]'::jsonb),
    'certificatesExpiring', (select count(*) from ce where ce.expires_on >= v_today),
    'certificatesExpired', (select count(*) from ce where ce.expires_on < v_today),
    'nonconformities', (select count(*) from nc where (p_from is null or nc.occurred_on >= p_from) and (p_to is null or nc.occurred_on <= p_to)),
    'nonconformitiesOpen', (select count(*) from nc where nc.status = 'open')
  ) into v_suppliers;

  with kr as (
    select r.received_on, r.limit_status from public.kitchen_receipts r
    where not l_kit
      and (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_from is null or r.received_on >= p_from) and (p_to is null or r.received_on <= p_to)
  ),
  km as (
    select to_char(kr.received_on, 'YYYY-MM') as month, count(*) as total, count(*) filter (where kr.limit_status = 'out') as out_of_limits
    from kr group by 1
  ),
  kd as (
    select p.verified_at from public.kitchen_productions p
    where not l_kit
      and (p_organization_id is null or p.organization_id = p_organization_id)
      and (p_from is null or p.production_date >= p_from) and (p_to is null or p.production_date <= p_to)
      and p.production_date < v_today
  ),
  kt as (
    select t.limit_status from public.kitchen_thermal_processes t
    where not l_kit
      and (p_organization_id is null or t.organization_id = p_organization_id)
      and (p_from is null or t.process_date >= p_from) and (p_to is null or t.process_date <= p_to)
      and t.limit_status is not null
  ),
  kf as (
    select f.verified_at from public.kitchen_defrosting f
    where not l_kit
      and (p_organization_id is null or f.organization_id = p_organization_id)
      and f.ended_at is not null
      and (p_from is null or f.ended_at >= p_from) and (p_to is null or f.ended_at < p_to + 1)
  ),
  kw as (
    select w.reason from public.kitchen_stock_writeoffs w
    where not l_kit
      and (p_organization_id is null or w.organization_id = p_organization_id)
      and (p_from is null or w.written_off_on >= p_from) and (p_to is null or w.written_off_on <= p_to)
  )
  select jsonb_build_object(
    'receipts', (select count(*) from kr),
    'receiptsOut', (select count(*) from kr where kr.limit_status = 'out'),
    'receiptsMonthly', coalesce((select jsonb_agg(jsonb_build_array(km.month, km.total, km.out_of_limits) order by km.month) from km), '[]'::jsonb),
    'productionDays', (select count(*) from kd),
    'productionDaysVerified', (select count(*) from kd where kd.verified_at is not null),
    'thermalMeasured', (select count(*) from kt),
    'thermalOut', (select count(*) from kt where kt.limit_status = 'out'),
    'defrosts', (select count(*) from kf),
    'defrostsVerified', (select count(*) from kf where kf.verified_at is not null),
    'writeoffs', (select count(*) from kw),
    'writeoffsByReason', coalesce((select jsonb_agg(jsonb_build_array(x.reason, x.n) order by x.n desc, x.reason) from (select kw.reason, count(*) as n from kw group by kw.reason) x), '[]'::jsonb)
  ) into v_kitchen;

  with rs as (
    select r.id, r.survey_id, r.answers, to_char(r.submitted_at, 'YYYY-MM') as month
    from public.quality_survey_responses r
    where not l_qual
      and (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_department_id is null or r.department_id = p_department_id)
      and (p_from is null or r.submitted_at >= p_from) and (p_to is null or r.submitted_at < p_to + 1)
  ),
  sv as (
    select s.id, s.title, s.audience, s.questions from public.quality_surveys s
    where s.id in (select distinct rs.survey_id from rs)
  ),
  ra as (
    select rs.survey_id, rs.month, sv.audience, v.value
    from rs
    join sv on sv.id = rs.survey_id
    cross join lateral jsonb_array_elements(sv.questions) q
    cross join lateral (select rs.answers -> (q ->> 'id') as value) v
    where q ->> 'type' = 'rating'
      and v.value is not null and jsonb_typeof(v.value) <> 'null' and v.value <> '""'::jsonb
  ),
  rn as (
    select ra.survey_id, ra.month, ra.audience,
      coalesce((ra.value #>> '{}') ~ '^\s*[45](\.0+)?\s*$', false) as satisfied
    from ra
  ),
  bs as (
    select sv.title, count(distinct rs.id) as responses,
      (select count(*) from rn where rn.survey_id = sv.id) as answered,
      (select count(*) from rn where rn.survey_id = sv.id and rn.satisfied) as satisfied
    from sv join rs on rs.survey_id = sv.id
    group by sv.id, sv.title
  ),
  bm as (
    select rn.month, count(*) as answered, count(*) filter (where rn.satisfied) as satisfied from rn group by rn.month
  )
  select jsonb_build_object(
    'surveyResponses', (select count(*) from rs join sv on sv.id = rs.survey_id),
    'ratingAnswers', (select count(*) from rn),
    'satisfiedAnswers', (select count(*) from rn where rn.satisfied),
    'patientRatingAnswers', (select count(*) from rn where rn.audience = 'patients'),
    'patientSatisfiedAnswers', (select count(*) from rn where rn.audience = 'patients' and rn.satisfied),
    'bySurvey', coalesce((select jsonb_agg(jsonb_build_array(bs.title, bs.responses, bs.answered, bs.satisfied) order by bs.responses desc, bs.title) from bs), '[]'::jsonb),
    'satisfactionMonthly', coalesce((select jsonb_agg(jsonb_build_array(bm.month, bm.answered, bm.satisfied) order by bm.month) from bm), '[]'::jsonb)
  ) into v_surveys;

  with cur as (
    select distinct on (a.organization_id) a.id, a.organization_id
    from public.quality_risk_assessments a
    where not l_qual
      and (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_to is null or a.assessed_on <= p_to)
    order by a.organization_id, (a.status = 'draft'), a.assessed_on desc, a.created_at desc
  ),
  rk as (
    select case when r.residual_score is null then null
                when r.residual_score <= 3 then 'low'
                when r.residual_score <= 6 then 'moderate'
                when r.residual_score <= 12 then 'high'
                else 'very_high' end as level
    from public.quality_risks r
    join cur on cur.id = r.assessment_id and cur.organization_id = r.organization_id
  ),
  op as (
    select o.effectiveness_status as status, lower(btrim(coalesce(o.effectiveness, ''))) as note
    from public.quality_risk_opportunities o
    join cur on cur.id = o.assessment_id and cur.organization_id = o.organization_id
  )
  select jsonb_build_object(
    'risks', (select count(*) from rk),
    'risksByLevel', (
      select jsonb_agg(jsonb_build_array(l.level, (select count(*) from rk where rk.level = l.level)) order by l.position)
      from (values ('very_high', 1), ('high', 2), ('moderate', 3), ('low', 4)) l(level, position)),
    'risksHigh', (select count(*) from rk where rk.level in ('high', 'very_high')),
    'opportunities', (select count(*) from op),
    'opportunitiesOpen', (
      select count(*) from op
      where coalesce(op.status, 'pending') = 'pending'
        and (op.status is not null or op.note !~ '^(μη αποτελεσματ|αναποτελεσματ|μερικ|αποτελεσματ|not effective|ineffective|partly|partial|effective)'))
  ) into v_risks;

  return jsonb_build_object('qualityFood', v_audits || v_suppliers || v_kitchen || v_surveys || v_risks);
end;
$function$;
