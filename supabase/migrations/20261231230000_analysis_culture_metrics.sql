-- Analysis «Καλλιέργειες»: environmental and staff-check samples with their validated result,
-- per department, and the most frequent organisms. Staff are counted only, never named.
create or replace function public.analysis_culture_metrics(
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
as $fn$
declare
  r jsonb;
  l_locked boolean := private.org_modules_locked(p_organization_id, array['analysis'])
    or private.org_modules_locked(p_organization_id, array['laboratory']);
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','hospital_director']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  if l_locked then
    return jsonb_build_object('rows','[]'::jsonb,'organisms','[]'::jsonb);
  end if;

  with latest as (
    select distinct on (r.sample_id) r.sample_id, r.result_status, r.within_limit, r.organism
    from public.microbiology_results r
    where r.validation_status <> 'draft'
      and (p_organization_id is null or r.organization_id = p_organization_id)
    order by r.sample_id, coalesce(r.validated_at, r.created_at) desc
  ),
  s as (
    select
      case when ls.subject_type = 'employee' then 'staff' else 'environment' end as kind,
      coalesce(d.name, 'Χωρίς τμήμα') as department,
      case
        when l.result_status = 'negative' then 'negative'
        when l.result_status = 'positive' and l.within_limit is true then 'within'
        else 'positive'
      end as outcome,
      nullif(trim(l.organism), '') as organism
    from public.laboratory_samples ls
    join latest l on l.sample_id = ls.id
    left join public.departments d on d.id = ls.department_id
    where ls.subject_type in ('environment', 'employee')
      and l.result_status in ('negative', 'positive')
      and (p_organization_id is null or ls.organization_id = p_organization_id)
      and (p_department_id is null or ls.department_id = p_department_id)
      and (p_from is null or (coalesce(ls.collected_at, ls.created_at) at time zone 'Europe/Athens')::date >= p_from)
      and (p_to is null or (coalesce(ls.collected_at, ls.created_at) at time zone 'Europe/Athens')::date <= p_to)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_array(kind, department, total, negative, within_lim, positive) order by kind, total desc)
      from (
        select kind, department, count(*) total,
          count(*) filter (where outcome = 'negative') negative,
          count(*) filter (where outcome = 'within') within_lim,
          count(*) filter (where outcome = 'positive') positive
        from s group by kind, department
      ) x), '[]'::jsonb),
    'organisms', coalesce((select jsonb_agg(jsonb_build_array(kind, organism, n) order by kind, n desc)
      from (
        select kind, organism, count(*) n from s
        where organism is not null and outcome <> 'negative'
        group by kind, organism
      ) y), '[]'::jsonb)
  ) into r;
  return r;
end $fn$;

revoke all on function public.analysis_culture_metrics(uuid,date,date,uuid) from public;
revoke all on function public.analysis_culture_metrics(uuid,date,date,uuid) from anon;
grant execute on function public.analysis_culture_metrics(uuid,date,date,uuid) to authenticated, service_role;
