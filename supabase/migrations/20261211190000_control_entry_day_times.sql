-- Controls, «Adherence»: the regular entries of each assignment over a period,
-- one row per assignment ({ 'YYYY-MM-DD': [minutes after midnight, …] }), so
-- a year of a hospital's controls comes in one read (one row per day hit the
-- 1000-row page limit and left most assignments without entries). Read with
-- the caller's rights (RLS on control_executions). Replaces control_entry_times.
create or replace function public.control_entry_day_times(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, days jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.assignment_id, jsonb_object_agg(d.day, d.minutes)
  from (
    select e.assignment_id, (e.performed_at at time zone p_tz)::date::text as day,
           jsonb_agg((extract(hour from e.performed_at at time zone p_tz) * 60 + extract(minute from e.performed_at at time zone p_tz))::integer order by e.performed_at) as minutes
    from public.control_executions e
    where e.organization_id = p_organization_id
      and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
      and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
      and e.performed_at <= least(p_to, now())
    group by e.assignment_id, (e.performed_at at time zone p_tz)::date
  ) d
  group by d.assignment_id
$$;

grant execute on function public.control_entry_day_times(uuid, timestamptz, timestamptz, text) to authenticated;
