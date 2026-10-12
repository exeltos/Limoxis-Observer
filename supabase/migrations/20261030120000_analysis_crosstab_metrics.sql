-- Analysis cross-tabulations for production organizations (the Demo sample
-- computes them in the browser). Cells are [row, column, count]; the client
-- adds them to the sections analysis_domain_metrics returns:
--   surveillance.haiByDepartment     department × HAI type
--   surveillance.organismByHaiType   causative organism × HAI type
--   surveillance.deviceAssociated    department × CLABSI / CAUTI / VAP
--   antimicrobial.byAgentDepartment  antimicrobial × department
--   antimicrobial.byAgentOrganism    antimicrobial × the episode's organism
--   controls.findingsByControl       control × department (executions with a finding)
--   controls.monthly                 executions per month
--   quality.severityByDepartment     department × severity
--   quality.monthly                  incidents per month
-- Same access and the same filters as analysis_domain_metrics. Read-only.
-- No SELECT/EXECUTE/RETURNING ... INTO outside the function body (the Supabase SQL editor rewrites those).

create or replace function public.analysis_crosstab_metrics(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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

  with
  sc as (
    select s.* from public.surveillance_cases s
    where (p_organization_id is null or s.organization_id = p_organization_id)
      and (p_department_id is null or s.department_id = p_department_id)
      and s.voided_at is null and coalesce(s.status, '') <> 'cancelled'
      and (p_from is null or coalesce(s.started_at, s.created_at)::date >= p_from)
      and (p_to is null or coalesce(s.started_at, s.created_at)::date <= p_to)
  ),
  dept as (select id, name from public.departments),
  -- The latest classification of each episode, as in analysis_domain_metrics.
  hai as (
    select distinct on (h.surveillance_case_id) h.*, sc.department_id
    from public.hai_classifications h
    join sc on sc.id = h.surveillance_case_id
    order by h.surveillance_case_id, h.classified_at desc nulls last, h.created_at desc
  ),
  -- The organism of each episode: its latest validated (or amended), not superseded result.
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
  -- CLABSI / CAUTI / VAP: from the HAI type, or a bloodstream / urinary / pneumonia
  -- HAI on an episode with the matching device.
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
    where (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_department_id is null or sc.department_id = p_department_id)
      and (p_from is null or coalesce(a.started_at, a.created_at)::date >= p_from)
      and (p_to is null or coalesce(a.started_at, a.created_at)::date <= p_to)
  ),
  ce as (
    select c.* from public.control_executions c
    where (p_organization_id is null or c.organization_id = p_organization_id)
      and (p_department_id is null or c.department_id = p_department_id)
      and c.cancelled_at is null
      and (p_from is null or coalesce(c.performed_at, c.created_at)::date >= p_from)
      and (p_to is null or coalesce(c.performed_at, c.created_at)::date <= p_to)
  ),
  qi as (
    select q.* from public.quality_incidents q
    where (p_organization_id is null or q.organization_id = p_organization_id)
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
  ) into r;
  return r;
end $function$;

revoke all on function public.analysis_crosstab_metrics(uuid, date, date, uuid) from public, anon;
grant execute on function public.analysis_crosstab_metrics(uuid, date, date, uuid) to authenticated;
