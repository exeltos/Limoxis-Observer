-- Controls, «Adherence»: the regular entries of each assignment per local day
-- of a period, so the report can name the days (and weeks) a control was
-- missed. Read with the caller's rights (RLS on control_executions).
create or replace function public.control_entry_days(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, day date, entries integer)
language sql stable security invoker set search_path = ''
as $$
  select e.assignment_id, (e.performed_at at time zone p_tz)::date, count(*)::integer
  from public.control_executions e
  where e.organization_id = p_organization_id
    and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
    and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
    and e.performed_at <= least(p_to, now())
  group by e.assignment_id, (e.performed_at at time zone p_tz)::date
$$;

grant execute on function public.control_entry_days(uuid, timestamptz, timestamptz, text) to authenticated;
