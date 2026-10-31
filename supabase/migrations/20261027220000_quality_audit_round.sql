-- Quality → Audits: an audit round. The internal audits planned for one month are
-- spread over a few working days (three by default), as even as possible and in
-- the departments' order, so not every department is audited on the same day.
-- Runs as the caller (security invoker): row-level security decides who may plan.

create or replace function public.quality_plan_audit_round(p_organization_id uuid, p_start date, p_days integer default 3)
returns integer
language plpgsql
set search_path = public
as $$
declare
  days date[];
  total integer;
  changed integer := 0;
begin
  select array_agg(d order by d) into days
  from (
    select d::date as d
    from generate_series(p_start, p_start + 30, interval '1 day') as d
    where extract(isodow from d) < 6
    order by d
    limit greatest(1, least(coalesce(p_days, 3), 10))
  ) working;

  select count(*) into total
  from public.quality_audits a
  where a.organization_id = p_organization_id
    and a.status = 'planned'
    and a.lifecycle_status <> 'voided'
    and coalesce(a.audit_kind, a.audit_type) = 'internal'
    and a.department_id is not null
    and date_trunc('month', a.planned_date) = date_trunc('month', p_start::timestamp);
  if total = 0 then
    return 0;
  end if;

  with ranked as (
    select a.id, row_number() over (order by d.name, a.id) - 1 as position
    from public.quality_audits a
    join public.departments d on d.id = a.department_id
    where a.organization_id = p_organization_id
      and a.status = 'planned'
      and a.lifecycle_status <> 'voided'
      and coalesce(a.audit_kind, a.audit_type) = 'internal'
      and date_trunc('month', a.planned_date) = date_trunc('month', p_start::timestamp)
  )
  update public.quality_audits a
  set planned_date = days[1 + least(array_length(days, 1) - 1, (ranked.position * array_length(days, 1) / total)::integer)],
      planned_month_only = false
  from ranked
  where a.id = ranked.id;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.quality_plan_audit_round(uuid, date, integer) to authenticated;
