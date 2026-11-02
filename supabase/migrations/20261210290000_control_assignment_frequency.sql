-- A control can run on a different schedule in each department: the assignment carries its own
-- frequency (frequency_config, same shape as the control's) and, when empty, the control's own
-- frequency applies. The FileMaker import split one control into several by schedule; with this
-- they can become one control with the departments that share it, each on its own schedule.
alter table public.control_assignments add column if not exists frequency_config jsonb;
comment on column public.control_assignments.frequency_config is 'This department''s own schedule (kind, times, timesPerDay, interval, toleranceMinutes); null = the control''s frequency_config.';

-- Calendar months: «frequent» follows the department's own schedule.
create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC'::text)
returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)
language plpgsql
stable
set search_path to ''
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  with picked as (
    select m.assignment_id, (m.performed_at at time zone p_time_zone) as local_at, not m.on_time as is_late,
           case
             when f.cfg ->> 'kind' in ('daily', 'weekly') then true
             when f.cfg ->> 'kind' in ('monthly', 'yearly') then false
             else coalesce(case when f.cfg ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                then nullif((f.cfg ->> 'interval')::numeric, 0) end, 1) < 28
           end as frequent
    from private.control_execution_marks(p_organization_id, make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone), make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_time_zone) - interval '1 microsecond') m
    join public.control_assignments a on a.id = m.assignment_id
    join public.control_definitions d on d.id = a.control_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) f
    where m.counted
  )
  select r.assignment_id,
         extract(month from r.local_at)::integer - 1,
         count(*),
         count(*) filter (where r.is_late),
         case when bool_or(r.frequent) then '[]'::jsonb
              else jsonb_agg(jsonb_build_object('day', extract(day from r.local_at)::integer, 'late', r.is_late) order by r.local_at) end
  from picked r
  group by r.assignment_id, extract(month from r.local_at);
end;
$function$;

-- Marks: the schedule is read per assignment (its own, else the control's).
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
           private.control_required(s.cfg) as required, private.control_slot_deadlines(s.cfg) as deadlines
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) s
    where a.organization_id = p_organization_id
  ), ranked as (
    select e.assignment_id, e.performed_at, x.f, x.daily, x.required, x.deadlines, x.created_at,
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
$function$;

-- A new entry is checked against the department's own schedule.
create or replace function private.control_executions_period_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_frequency jsonb;
  v_required integer;
  v_done integer;
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.status = 'cancelled' or new.cancelled_at is not null then return new; end if;
  if coalesce(new.is_extra, false) then
    if nullif(btrim(coalesce(new.extra_reason, '')), '') is null then
      raise exception 'control_extra_reason_required' using errcode = 'P0001', hint = 'An extra entry needs its reason.';
    end if;
    return new;
  end if;
  new.is_extra := false;
  select coalesce(a.frequency_config, d.frequency_config) into v_frequency
  from public.control_definitions d
  left join public.control_assignments a on a.id = new.assignment_id
  where d.id = new.control_id;
  v_frequency := coalesce(v_frequency, '{"kind":"daily","times":["09:00"]}'::jsonb);
  v_start := private.control_period_start(v_frequency, new.performed_at);
  v_end := private.control_period_end(v_frequency, new.performed_at);
  if not ((now() >= v_start and now() < v_end) or (auth.uid() is not null and new.performed_at > now() - interval '31 days')) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('control_assignment:' || new.assignment_id::text, 0));
  v_required := private.control_required(v_frequency);
  select count(*) into v_done from public.control_executions e
  where e.assignment_id = new.assignment_id and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
    and e.performed_at >= v_start and e.performed_at < v_end;
  if v_done >= v_required then
    raise exception 'control_period_complete' using errcode = 'P0001',
      detail = json_build_object('done', v_done, 'required', v_required, 'period_start', v_start, 'period_end', v_end)::text,
      hint = 'The required entries for this period are complete; record an extra entry with its reason.';
  end if;
  return new;
end;
$function$;

-- The period's progress per assignment, on the department's own schedule.
create or replace function public.control_period_progress(p_organization_id uuid)
returns table(assignment_id uuid, required integer, done bigint, extra bigint, period_start timestamp with time zone, period_end timestamp with time zone)
language plpgsql
stable
set search_path to ''
set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  with periods as materialized (
    select a.id, a.organization_id,
           private.control_required(s.cfg) as req,
           private.control_period_start(s.cfg, now()) as s,
           private.control_period_end(s.cfg, now()) as e
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) s
    where a.organization_id = p_organization_id and a.status <> 'paused'
  )
  select p.id, p.req, c.done, c.extra, p.s, p.e
  from periods p
  cross join lateral (
    select count(*) filter (where not x.is_extra) as done,
           count(*) filter (where x.is_extra) as extra
    from public.control_executions x
    where x.assignment_id = p.id and x.organization_id = p.organization_id
      and x.status <> 'cancelled' and x.cancelled_at is null
      and x.performed_at >= p.s and x.performed_at < p.e
  ) c;
end;
$function$;

-- The next due date follows the department's own schedule.
create or replace function private.control_refresh_assignment_due(p_assignment_id uuid, p_fallback_due timestamp with time zone default null::timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_frequency jsonb;
  v_last timestamptz;
  v_done integer;
begin
  select coalesce(a.frequency_config, d.frequency_config) into v_frequency
  from public.control_assignments a join public.control_definitions d on d.id = a.control_id
  where a.id = p_assignment_id;
  if not found then return; end if;
  v_frequency := coalesce(v_frequency, '{"kind":"daily","times":["09:00"]}'::jsonb);
  select max(e.performed_at) into v_last from public.control_executions e
  where e.assignment_id = p_assignment_id and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra;
  if v_last is null then
    update public.control_assignments set last_completed_at = null, next_due_at = coalesce(p_fallback_due, next_due_at)
    where id = p_assignment_id and (last_completed_at is not null or (p_fallback_due is not null and next_due_at is distinct from p_fallback_due));
    return;
  end if;
  select count(*) into v_done from public.control_executions e
  where e.assignment_id = p_assignment_id and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
    and e.performed_at >= private.control_period_start(v_frequency, v_last) and e.performed_at < private.control_period_end(v_frequency, v_last);
  update public.control_assignments
  set last_completed_at = v_last, next_due_at = private.control_next_due(v_frequency, v_last, v_done)
  where id = p_assignment_id
    and (last_completed_at is distinct from v_last or next_due_at is distinct from private.control_next_due(v_frequency, v_last, v_done));
end;
$function$;
