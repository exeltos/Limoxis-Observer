-- Controls, «Adherence»: the regular entries of each assignment per local day
-- of a period, as minutes after midnight, so the report can name the date and
-- the time of each missed execution. Read with the caller's rights (RLS on
-- control_executions). Replaces control_entry_days (counts only).
create or replace function public.control_entry_times(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, day date, minutes integer[])
language sql stable security invoker set search_path = ''
as $$
  select e.assignment_id, (e.performed_at at time zone p_tz)::date,
         array_agg((extract(hour from e.performed_at at time zone p_tz) * 60 + extract(minute from e.performed_at at time zone p_tz))::integer order by e.performed_at)
  from public.control_executions e
  where e.organization_id = p_organization_id
    and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
    and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
    and e.performed_at <= least(p_to, now())
  group by e.assignment_id, (e.performed_at at time zone p_tz)::date
$$;

grant execute on function public.control_entry_times(uuid, timestamptz, timestamptz, text) to authenticated;
