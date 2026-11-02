-- Controls, the «Times» report: when each department really records its daily
-- controls. Per assignment and slot (the k-th entry of a local day is slot k),
-- the minutes after midnight of the regular entries of a period. Read with the
-- caller's rights (RLS on control_executions). Used by controlTimeFit.js to
-- propose set times that fit the department's practice.
create or replace function public.control_execution_times(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, slot integer, minutes integer[])
language sql stable security invoker set search_path = ''
as $$
  select r.assignment_id, r.rk::integer, array_agg(r.m order by r.m)
  from (
    select e.assignment_id,
           row_number() over (partition by e.assignment_id, (e.performed_at at time zone p_tz)::date order by e.performed_at, e.id) as rk,
           (extract(hour from e.performed_at at time zone p_tz) * 60 + extract(minute from e.performed_at at time zone p_tz))::integer as m
    from public.control_executions e
    where e.organization_id = p_organization_id
      and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
      and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
      and e.performed_at <= least(p_to, now())
  ) r
  group by r.assignment_id, r.rk
$$;

grant execute on function public.control_execution_times(uuid, timestamptz, timestamptz, text) to authenticated;
