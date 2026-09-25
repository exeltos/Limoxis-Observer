-- Analysis page: real indicators per section (rates, breakdowns, open work)
-- instead of plain record counts. Same access rule as platform_report_summary:
-- Platform Owner, or Hospital Admin / Infection Control Lead of the organization.
-- Voided / cancelled records never count.
create or replace function public.analysis_domain_metrics(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
    where (p_organization_id is null or s.organization_id=p_organization_id)
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
    where (p_organization_id is null or h.organization_id=p_organization_id)
      and (p_department_id is null or h.department_id=p_department_id)
      and coalesce(h.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(h.observation_date,h.created_at::date)>=p_from)
      and (p_to is null or coalesce(h.observation_date,h.created_at::date)<=p_to)
  ),
  pb as (
    select b.* from public.prevention_bundle_assessments b
    where (p_organization_id is null or b.organization_id=p_organization_id)
      and (p_department_id is null or b.department_id=p_department_id)
      and coalesce(b.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(b.assessment_date,b.created_at::date)>=p_from)
      and (p_to is null or coalesce(b.assessment_date,b.created_at::date)<=p_to)
  ),
  wm as (
    select w.* from public.waste_measurements w
    where (p_organization_id is null or w.organization_id=p_organization_id)
      and (p_department_id is null or w.department_id=p_department_id)
      and coalesce(w.status,'') not in ('cancelled','void','voided')
      and (p_from is null or coalesce(w.record_date,w.created_at::date)>=p_from)
      and (p_to is null or coalesce(w.record_date,w.created_at::date)<=p_to)
  ),
  ce as (
    select c.* from public.control_executions c
    where (p_organization_id is null or c.organization_id=p_organization_id)
      and (p_department_id is null or c.department_id=p_department_id)
      and c.cancelled_at is null
      and (p_from is null or coalesce(c.performed_at,c.created_at)::date>=p_from)
      and (p_to is null or coalesce(c.performed_at,c.created_at)::date<=p_to)
  ),
  qi as (
    select q.* from public.quality_incidents q
    where (p_organization_id is null or q.organization_id=p_organization_id)
      and (p_department_id is null or q.department_id=p_department_id)
      and q.voided_at is null
      and (p_from is null or coalesce(q.occurred_at,q.created_at)::date>=p_from)
      and (p_to is null or coalesce(q.occurred_at,q.created_at)::date<=p_to)
  ),
  qc as (
    select q.* from public.quality_capa_actions q
    where (p_organization_id is null or q.organization_id=p_organization_id)
      and (p_department_id is null or q.department_id=p_department_id)
      and q.voided_at is null
  ),
  am as (
    select a.* from public.antimicrobial_therapies a
    where (p_organization_id is null or a.organization_id=p_organization_id)
      and (p_from is null or coalesce(a.started_at,a.created_at)::date>=p_from)
      and (p_to is null or coalesce(a.started_at,a.created_at)::date<=p_to)
  ),
  iso as (
    select i.* from public.isolation_episodes i
    where (p_organization_id is null or i.organization_id=p_organization_id)
      and (p_department_id is null or i.department_id=p_department_id)
  ),
  dev as (
    select d.* from public.surveillance_devices d
    where (p_organization_id is null or d.organization_id=p_organization_id)
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
      'overdueAssignments',(select count(*) from public.control_assignments a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_department_id is null or a.department_id=p_department_id) and coalesce(a.status,'active')='active' and a.next_due_at<now()),
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
end $$;

revoke all on function public.analysis_domain_metrics(uuid,date,date,uuid) from public;
grant execute on function public.analysis_domain_metrics(uuid,date,date,uuid) to authenticated;
