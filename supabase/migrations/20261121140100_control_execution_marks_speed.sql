-- Controls: private.control_execution_marks reads each control's frequency
-- once. Its definitions CTE was inlined into the join, so the frequency helpers
-- (SQL functions with their own search_path, never inlined) ran once per entry:
-- a year of an organisation with 180,000 entries took 55 s. Materialised, the
-- same count takes under half a second. Same result, same signature.

create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, performed_at timestamptz, counted boolean, on_time boolean)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with defs as materialized (
    select d.id, d.created_at, d.frequency_config as f, d.frequency_config ->> 'kind' = 'daily' as daily,
           private.control_required(d.frequency_config) as required, private.control_slot_deadlines(d.frequency_config) as deadlines
    from public.control_definitions d where d.organization_id = p_organization_id
  ), ranked as (
    select e.assignment_id, e.performed_at, x.f, x.daily, x.required, x.deadlines, x.created_at,
           (e.performed_at at time zone p_tz)::date as local_day,
           row_number() over (partition by e.assignment_id, (e.performed_at at time zone p_tz)::date order by e.performed_at, e.id) as rk
    from public.control_executions e join defs x on x.id = e.control_id
    where e.organization_id = p_organization_id
      and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
      and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
      and e.performed_at <= least(p_to, now())
  )
  select r.assignment_id, r.performed_at,
         (not r.daily or r.rk <= r.required),
         case when r.daily then r.rk <= r.required and r.performed_at <=
                case when r.deadlines[r.rk] >= 1440 then ((r.local_day + 1)::timestamp at time zone p_tz) - interval '1 second'
                     else (r.local_day::timestamp + make_interval(mins => r.deadlines[r.rk])) at time zone p_tz end
              else coalesce(r.performed_at <= private.control_next_due(r.f,
                     (select max(p.performed_at) from public.control_executions p
                      where p.assignment_id = r.assignment_id and p.performed_at < r.performed_at
                        and p.status <> 'cancelled' and p.cancelled_at is null and not p.is_extra), 1, p_tz), true) end
  from ranked r
  where r.performed_at >= greatest(p_from, r.created_at);
end;
$$;
