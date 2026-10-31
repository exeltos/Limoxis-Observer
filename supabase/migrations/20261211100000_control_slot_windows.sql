-- Controls: a window around each set time (approved by the owner).
--   once a day         on time from 1 hour before its time to 2 hours after it
--                      (08:00 → 07:00–10:00);
--   2 or more a day    1 hour before to 1 hour after each time;
--   the control's own  frequency.toleranceMinutes replaces the margin after.
-- Never past the next time or 23:59:59. After the window the control is
-- overdue (next_due_at has passed); done later the same day it is late; not
-- done, the slot is missed. A day split evenly without times keeps the old rule
-- (by the next slot). Mirrors src/features/controls/controlDueRules.js
-- (slotMargin, slotOpens, slotDeadline). Past entries are marked again by the
-- same functions, so adherence is recalculated for the history too.

-- The valid execution times of a daily control.
create or replace function private.control_set_times_count(p_frequency jsonb)
returns integer language sql immutable set search_path = '' as $$
  select count(distinct btrim(x))::integer
  from jsonb_array_elements_text(case when jsonb_typeof(p_frequency -> 'times') = 'array' then p_frequency -> 'times' else '[]'::jsonb end) x
  where case when btrim(x) ~ '^[0-9]{1,2}:[0-9]{2}$'
             then split_part(btrim(x), ':', 1)::integer < 24 and split_part(btrim(x), ':', 2)::integer < 60 else false end
$$;

-- Minutes after a set time that still count as on time (0: by the next slot).
create or replace function private.control_slot_margin(p_frequency jsonb)
returns integer language sql immutable set search_path = '' as $$
  select case when p_frequency ->> 'toleranceMinutes' ~ '^[0-9]+$' and (p_frequency ->> 'toleranceMinutes')::integer > 0
              then (p_frequency ->> 'toleranceMinutes')::integer
              when private.control_set_times_count(p_frequency) = 0 then 0
              when private.control_set_times_count(p_frequency) = 1 then 120
              else 60 end
$$;

create or replace function private.control_slot_deadlines(p_frequency jsonb)
returns integer[] language sql immutable set search_path = '' as $$
  select array_agg(case when t.margin > 0 then least(s.starts[i] + t.margin, coalesce(s.starts[i + 1], 1440)) else coalesce(s.starts[i + 1], 1440) end order by i)
  from (select private.control_slot_starts(p_frequency) as starts) s,
       (select private.control_slot_margin(p_frequency) as margin) t,
       generate_series(1, cardinality(s.starts)) i
$$;

-- The earliest on-time minute of each slot: 1 hour before its time, or the
-- start of the day for a day split evenly.
create or replace function private.control_slot_opens(p_frequency jsonb)
returns integer[] language sql immutable set search_path = '' as $$
  select array_agg(case when t.timed then greatest(0, s.starts[i] - 60) else 0 end order by i)
  from (select private.control_slot_starts(p_frequency) as starts) s,
       (select private.control_set_times_count(p_frequency) > 0 as timed) t,
       generate_series(1, cardinality(s.starts)) i
$$;

create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text default 'Europe/Athens'::text)
returns table(assignment_id uuid, performed_at timestamp with time zone, counted boolean, on_time boolean)
language plpgsql
stable
set search_path to ''
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  with defs as materialized (
    select a.id as assignment_id, d.created_at, s.cfg as f, s.cfg ->> 'kind' = 'daily' as daily,
           private.control_required(s.cfg) as required, private.control_slot_deadlines(s.cfg) as deadlines,
           private.control_slot_opens(s.cfg) as opens
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) s
    where a.organization_id = p_organization_id
  ), ranked as (
    select e.assignment_id, e.performed_at, x.f, x.daily, x.required, x.deadlines, x.opens, x.created_at,
           (e.performed_at at time zone p_tz)::date as local_day,
           row_number() over (partition by e.assignment_id, (e.performed_at at time zone p_tz)::date order by e.performed_at, e.id) as rk
    from public.control_executions e join defs x on x.assignment_id = e.assignment_id
    where e.organization_id = p_organization_id
      and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
      and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
      and e.performed_at <= least(p_to, now())
  )
  select r.assignment_id, r.performed_at,
         (not r.daily or r.rk <= r.required),
         case when r.daily then r.rk <= r.required
                and r.performed_at >= (r.local_day::timestamp + make_interval(mins => coalesce(r.opens[r.rk], 0))) at time zone p_tz
                and r.performed_at <=
                case when r.deadlines[r.rk] >= 1440 then ((r.local_day + 1)::timestamp at time zone p_tz) - interval '1 second'
                     else (r.local_day::timestamp + make_interval(mins => r.deadlines[r.rk])) at time zone p_tz end
              else coalesce(r.performed_at <= private.control_next_due(r.f,
                     (select max(p.performed_at) from public.control_executions p
                      where p.assignment_id = r.assignment_id and p.performed_at < r.performed_at
                        and p.status <> 'cancelled' and p.cancelled_at is null and not p.is_extra), 1, p_tz), true) end
  from ranked r
  where r.performed_at >= greatest(p_from, r.created_at);
end;
$function$;

-- next_due_at of the daily assignments follows the new windows.
do $$
declare r record;
begin
  for r in
    select a.id from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id
    where coalesce(a.frequency_config, d.frequency_config) ->> 'kind' = 'daily'
  loop
    perform private.control_refresh_assignment_due(r.id);
  end loop;
end;
$$;
