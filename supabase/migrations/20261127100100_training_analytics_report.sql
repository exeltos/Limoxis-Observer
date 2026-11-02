-- Detailed Training Analytics: completion cohort, person-hours, hours per trainee,
-- programme, department and professional-category breakdowns.
create or replace function public.analysis_training_metrics(
  p_organization_id uuid default null::uuid,
  p_from date default null::date,
  p_to date default null::date,
  p_department_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  r jsonb;
  l_all boolean := private.org_modules_locked(p_organization_id, array['analysis']);
  l_training boolean := l_all or private.org_modules_locked(p_organization_id, array['training']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  if l_training then
    return jsonb_build_object(
      'assignments',0,'completed',0,'overdue',0,'averageScore',null,'programs',0,
      'completedInPeriod',0,'trainees',0,'personHours',0,'averageHoursPerTrainee',null,
      'missingDurationCompletions',0,'hoursCoverage',null,
      'byDepartment','[]'::jsonb,'hoursByDepartment','[]'::jsonb,'byProgram','[]'::jsonb,
      'byEmployee','[]'::jsonb,'byProfession','[]'::jsonb,'monthlyHours','[]'::jsonb
    );
  end if;

  with
  assigned as (
    select
      a.id,a.program_id,a.employee_id,a.employee_code,a.employee_name,a.department_id,a.department_name,
      a.assigned_date,a.due_date,a.status,a.score,
      p.program_key,p.title,p.title_en,p.duration_hours,p.category,p.method,p.delivery_kind,
      coalesce(d.name,a.department_name,'—') as department_label,
      coalesce(e.profession_name,'—') as profession_label,
      coalesce(e.profession_name_en,e.profession_name,'—') as profession_label_en,
      coalesce(a.employee_id::text,nullif(a.employee_code,''),lower(nullif(a.employee_name,'')),a.id::text) as trainee_key
    from public.training_assignments a
    join public.training_programs p on p.id=a.program_id and p.organization_id=a.organization_id
    left join public.employees e on e.id=a.employee_id and e.organization_id=a.organization_id
    left join public.departments d on d.id=a.department_id
    where (p_organization_id is null or a.organization_id=p_organization_id)
      and (p_department_id is null or a.department_id=p_department_id)
      and (p_from is null or coalesce(a.assigned_date,a.created_at::date)>=p_from)
      and (p_to is null or coalesce(a.assigned_date,a.created_at::date)<=p_to)
      and a.status <> 'cancelled'
  ),
  completed_period as (
    select
      a.id,a.program_id,a.employee_id,a.employee_code,a.employee_name,a.department_id,a.department_name,
      a.completed_date,a.status,a.score,
      p.program_key,p.title,p.title_en,p.duration_hours,p.category,p.method,p.delivery_kind,
      coalesce(d.name,a.department_name,'—') as department_label,
      coalesce(e.profession_name,'—') as profession_label,
      coalesce(e.profession_name_en,e.profession_name,'—') as profession_label_en,
      coalesce(a.employee_id::text,nullif(a.employee_code,''),lower(nullif(a.employee_name,'')),a.id::text) as trainee_key
    from public.training_assignments a
    join public.training_programs p on p.id=a.program_id and p.organization_id=a.organization_id
    left join public.employees e on e.id=a.employee_id and e.organization_id=a.organization_id
    left join public.departments d on d.id=a.department_id
    where (p_organization_id is null or a.organization_id=p_organization_id)
      and (p_department_id is null or a.department_id=p_department_id)
      and a.status='completed'
      and a.completed_date is not null
      and (p_from is null or a.completed_date>=p_from)
      and (p_to is null or a.completed_date<=p_to)
  ),
  employee_cohort as (
    select trainee_key,
      max(coalesce(nullif(employee_name,''),nullif(employee_code,''),'—')) as employee_name,
      max(department_label) as department_label,
      max(profession_label) as profession_label,
      count(*) as assigned_count,
      count(*) filter (where status='completed') as cohort_completed,
      count(*) filter (where status not in ('completed','cancelled') and due_date<current_date) as overdue_count
    from assigned group by trainee_key
  ),
  employee_hours as (
    select trainee_key,
      max(coalesce(nullif(employee_name,''),nullif(employee_code,''),'—')) as employee_name,
      max(department_label) as department_label,
      max(profession_label) as profession_label,
      count(*) as completed_period_count,
      round(coalesce(sum(duration_hours),0)::numeric,1) as person_hours
    from completed_period group by trainee_key
  ),
  program_cohort as (
    select program_id,
      max(program_key) as program_key,max(title) as title,max(duration_hours) as duration_hours,
      count(*) as assigned_count,
      count(*) filter (where status='completed') as cohort_completed,
      count(*) filter (where status not in ('completed','cancelled') and due_date<current_date) as overdue_count
    from assigned group by program_id
  ),
  program_hours as (
    select program_id,
      max(program_key) as program_key,max(title) as title,max(duration_hours) as duration_hours,
      count(*) as completed_period_count,
      count(distinct trainee_key) as trainees,
      round(coalesce(sum(duration_hours),0)::numeric,1) as person_hours
    from completed_period group by program_id
  )
  select jsonb_build_object(
    'assignments',(select count(*) from assigned),
    'completed',(select count(*) from assigned where status='completed'),
    'overdue',(select count(*) from assigned where status not in ('completed','cancelled') and due_date<current_date),
    'averageScore',(select round(avg(score::numeric),1) from assigned where score is not null),
    'programs',(select count(distinct program_id) from assigned),
    'completedInPeriod',(select count(*) from completed_period),
    'trainees',(select count(distinct trainee_key) from completed_period),
    'personHours',(select round(coalesce(sum(duration_hours),0)::numeric,1) from completed_period),
    'averageHoursPerTrainee',(select round(coalesce(sum(duration_hours),0)::numeric/nullif(count(distinct trainee_key),0),2) from completed_period),
    'missingDurationCompletions',(select count(*) from completed_period where duration_hours is null or duration_hours<=0),
    'hoursCoverage',(select case when count(*)=0 then null else round(100.0*count(*) filter (where duration_hours is not null and duration_hours>0)/count(*),1) end from completed_period),
    'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,c) order by n desc) from (
      select department_label k,count(*) n,count(*) filter (where status='completed') c from assigned group by department_label
    ) x),'[]'::jsonb),
    'hoursByDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,t,h,avgh) order by h desc,k) from (
      select department_label k,count(*) n,count(distinct trainee_key) t,
        round(coalesce(sum(duration_hours),0)::numeric,1) h,
        round(coalesce(sum(duration_hours),0)::numeric/nullif(count(distinct trainee_key),0),2) avgh
      from completed_period group by department_label
    ) x),'[]'::jsonb),
    'byProgram',coalesce((select jsonb_agg(jsonb_build_array(
      coalesce(pc.program_key,ph.program_key),coalesce(pc.title,ph.title,'—'),coalesce(pc.duration_hours,ph.duration_hours),
      coalesce(pc.assigned_count,0),coalesce(pc.cohort_completed,0),coalesce(ph.completed_period_count,0),coalesce(ph.trainees,0),coalesce(ph.person_hours,0),coalesce(pc.overdue_count,0)
    ) order by coalesce(ph.person_hours,0) desc,coalesce(pc.title,ph.title,'—'))
    from program_cohort pc full join program_hours ph using(program_id)),'[]'::jsonb),
    'byEmployee',coalesce((select jsonb_agg(jsonb_build_array(
      coalesce(ec.trainee_key,eh.trainee_key),coalesce(ec.employee_name,eh.employee_name,'—'),coalesce(ec.department_label,eh.department_label,'—'),coalesce(ec.profession_label,eh.profession_label,'—'),
      coalesce(ec.assigned_count,0),coalesce(ec.cohort_completed,0),coalesce(eh.completed_period_count,0),coalesce(eh.person_hours,0),coalesce(ec.overdue_count,0)
    ) order by coalesce(eh.person_hours,0) desc,coalesce(ec.employee_name,eh.employee_name,'—'))
    from employee_cohort ec full join employee_hours eh using(trainee_key)),'[]'::jsonb),
    'byProfession',coalesce((select jsonb_agg(jsonb_build_array(k,t,n,h) order by h desc,k) from (
      select profession_label k,count(distinct trainee_key) t,count(*) n,round(coalesce(sum(duration_hours),0)::numeric,1) h
      from completed_period group by profession_label
    ) x),'[]'::jsonb),
    'monthlyHours',coalesce((select jsonb_agg(jsonb_build_array(k,h) order by k) from (
      select to_char(completed_date,'YYYY-MM') k,round(coalesce(sum(duration_hours),0)::numeric,1) h
      from completed_period group by 1
    ) x),'[]'::jsonb)
  ) into r;
  return r;
end $function$;

revoke all on function public.analysis_training_metrics(uuid,date,date,uuid) from public;
revoke all on function public.analysis_training_metrics(uuid,date,date,uuid) from anon;
grant execute on function public.analysis_training_metrics(uuid,date,date,uuid) to authenticated, service_role;
