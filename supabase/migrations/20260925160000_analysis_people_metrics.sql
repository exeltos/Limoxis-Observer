-- Analysis page: workforce health, training and governance indicators.
-- Same access rule as analysis_domain_metrics. Occupational health figures are
-- aggregated only and returned only to users with the view_occupational_health
-- capability (never to the Platform Owner, never per employee).
create or replace function public.analysis_people_metrics(
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
declare
  r jsonb;
  can_health boolean := p_organization_id is not null and public.current_user_has_capability(p_organization_id,'view_occupational_health');
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
  emp as (
    select e.* from public.employees e
    where (p_organization_id is null or e.organization_id=p_organization_id)
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
    select t.payload p, t.department_id from public.training_records t
    where t.record_type='assignment'
      and (p_organization_id is null or t.organization_id=p_organization_id)
      and (p_department_id is null or t.department_id=p_department_id)
      and (p_from is null or coalesce(nullif(t.payload->>'assignedDate','')::date,t.created_at::date)>=p_from)
      and (p_to is null or coalesce(nullif(t.payload->>'assignedDate','')::date,t.created_at::date)<=p_to)
  ),
  doc as (
    select d.* from public.controlled_documents d
    where (p_organization_id is null or d.organization_id=p_organization_id)
      and (p_department_id is null or d.department_id=p_department_id)
      and coalesce(d.status,'') not in ('archived','superseded','void','voided')
  ),
  mtg as (
    select m.* from public.committee_meetings m
    where p_department_id is null
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
      'completed',(select count(*) from tra where coalesce(p->>'computedStatus',p->>'status')='completed'),
      'overdue',(select count(*) from tra where coalesce(p->>'computedStatus',p->>'status') not in ('completed','cancelled') and nullif(p->>'dueDate','')::date<current_date),
      'averageScore',(select round(avg(nullif(p->>'score','')::numeric),1) from tra where nullif(p->>'score','') is not null),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,c) order by n desc) from (select coalesce(d.name,tra.p->>'department','—') k,count(*) n,count(*) filter (where coalesce(tra.p->>'computedStatus',tra.p->>'status')='completed') c from tra left join dept d on d.id=tra.department_id group by 1) x),'[]'::jsonb)
    ),
    'governance', jsonb_build_object(
      'documents',(select count(*) from doc),
      'published',(select count(*) from doc where status in ('published','approved')),
      'reviewOverdue',(select count(*) from doc where status in ('published','approved') and review_date<current_date),
      'byType',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(document_type,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'byStatus',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(status,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'committees',case when p_department_id is null then (select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and coalesce(c.status,'active')='active') else null end,
      'meetings',(select count(*) from mtg where cancelled_at is null),
      'minutesFinalized',(select count(*) from mtg where finalized_at is not null),
      'minutesPending',(select count(*) from mtg where cancelled_at is null and finalized_at is null and scheduled_at<now())
    )
  ) into r;
  return r;
end $$;

revoke all on function public.analysis_people_metrics(uuid,date,date,uuid) from public;
grant execute on function public.analysis_people_metrics(uuid,date,date,uuid) to authenticated;
