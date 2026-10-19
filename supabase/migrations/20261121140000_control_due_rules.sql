-- Controls: one due rule per frequency, kept by the database, and a guard
-- against entries beyond what a period requires.
--
-- Why: almost every daily control showed as overdue. next_due_at was set by the
-- browser as "the next execution time after now", so an entry made a few
-- minutes before its slot (08:55 for 09:00) set next_due_at to that same slot
-- and the control turned overdue minutes later; a daily control was overdue at
-- 09:01 with no tolerance; times were the browser's, not the hospital's; and a
-- signed-in user without manage_controls could not update control_assignments
-- at all (RLS), so their entries never moved next_due_at.
--
-- The rule (mirrored by src/features/controls/controlDueRules.js), in
-- Europe/Athens:
--   daily, N a day   N slots (the execution times, or the day split evenly);
--                    slot i is due by the next slot's time, the last by 23:59:59;
--                    frequency_config.toleranceMinutes shortens that to slot
--                    time + tolerance (never past the next slot). The k-th entry
--                    of a day covers slot k.
--   every N days     by 23:59:59 on the N-th day after the last entry.
--   weekly           by Sunday 23:59:59 of the N-th week after the entry's week.
--   monthly          by the last day of the N-th month after the entry's month.
--   yearly           by 31 December of the N-th year after the entry's year.
-- The period whose required entries are counted is the day (daily, every N
-- days), the week, the month or the year: N entries a day for daily controls,
-- one otherwise.
--
-- control_executions.is_extra / extra_reason: an extra entry («Έκτακτη
-- καταχώρηση», after a deviation or a repeat measurement) with its reason. It is
-- kept and shown, never counted towards the period, adherence or next_due_at.
--
-- Triggers on control_executions:
--   control_executions_period_guard (before insert): a regular entry in a period
--     that already holds its required entries is refused
--     (control_period_complete); an extra entry needs its reason
--     (control_extra_reason_required). Only the current period is checked (and,
--     for a signed-in caller, the last 31 days), so imported history and
--     corrections are never touched.
--   control_executions_refresh_due (after insert / void): last_completed_at and
--     next_due_at of the assignment from its regular entries.
-- New RPC public.control_period_progress(org): the current period per
-- assignment (required, done, extra) for «3/4 σήμερα».
-- control_adherence_counts and control_calendar_months count with the same
-- rule (first N entries of a day, by their slot deadline; otherwise by the
-- deadline the previous entry set) and leave extra entries out.

alter table public.control_executions add column if not exists is_extra boolean not null default false;
alter table public.control_executions add column if not exists extra_reason text;
comment on column public.control_executions.is_extra is 'An extra entry beyond the period''s required ones («Έκτακτη καταχώρηση»): recorded with extra_reason, never counted towards the period, adherence or next_due_at.';

-- Slot start times of a daily control, minutes after midnight, in order.
create or replace function private.control_slot_starts(p_frequency jsonb)
returns integer[] language sql immutable set search_path = '' as $$
  select case when cardinality(t.starts) > 0 then t.starts
              else (select array_agg((i * 1440 / n.n)::integer order by i) from generate_series(0, n.n - 1) i) end
  from (select array(select distinct (split_part(btrim(x), ':', 1)::integer * 60 + split_part(btrim(x), ':', 2)::integer) m
                     from jsonb_array_elements_text(case when jsonb_typeof(p_frequency -> 'times') = 'array' then p_frequency -> 'times' else '[]'::jsonb end) x
                     where case when btrim(x) ~ '^[0-9]{1,2}:[0-9]{2}$'
                                then split_part(btrim(x), ':', 1)::integer < 24 and split_part(btrim(x), ':', 2)::integer < 60 else false end
                     order by 1) as starts) t,
       (select greatest(1, case when p_frequency ->> 'timesPerDay' ~ '^[0-9]+$' then (p_frequency ->> 'timesPerDay')::integer else 1 end) as n) n
$$;

-- Entries a period requires.
create or replace function private.control_required(p_frequency jsonb)
returns integer language sql immutable set search_path = '' as $$
  select case when p_frequency ->> 'kind' = 'daily' then cardinality(private.control_slot_starts(p_frequency)) else 1 end
$$;

-- Deadline of each slot, minutes after midnight (1440: the end of the day).
create or replace function private.control_slot_deadlines(p_frequency jsonb)
returns integer[] language sql immutable set search_path = '' as $$
  select array_agg(case when tol > 0 then least(s.starts[i] + tol, coalesce(s.starts[i + 1], 1440)) else coalesce(s.starts[i + 1], 1440) end order by i)
  from (select private.control_slot_starts(p_frequency) as starts) s,
       (select case when p_frequency ->> 'toleranceMinutes' ~ '^[0-9]+$' then (p_frequency ->> 'toleranceMinutes')::integer else 0 end as tol) t,
       generate_series(1, cardinality(s.starts)) i
$$;

create or replace function private.control_period_unit(p_frequency jsonb)
returns text language sql immutable set search_path = '' as $$
  select case p_frequency ->> 'kind' when 'weekly' then 'week' when 'monthly' then 'month' when 'yearly' then 'year' else 'day' end
$$;

-- Start of the period holding p_at (end: start + one unit).
create or replace function private.control_period_start(p_frequency jsonb, p_at timestamptz, p_tz text default 'Europe/Athens')
returns timestamptz language sql immutable set search_path = '' as $$
  select date_trunc(private.control_period_unit(p_frequency), p_at at time zone p_tz) at time zone p_tz
$$;
create or replace function private.control_period_end(p_frequency jsonb, p_at timestamptz, p_tz text default 'Europe/Athens')
returns timestamptz language sql immutable set search_path = '' as $$
  select (date_trunc(private.control_period_unit(p_frequency), p_at at time zone p_tz) + ('1 ' || private.control_period_unit(p_frequency))::interval) at time zone p_tz
$$;

-- A slot deadline on a local day.
create or replace function private.control_slot_deadline(p_frequency jsonb, p_day date, p_index integer, p_tz text default 'Europe/Athens')
returns timestamptz language sql immutable set search_path = '' as $$
  select case when m >= 1440 then ((p_day + 1)::timestamp at time zone p_tz) - interval '1 second'
              else (p_day::timestamp + make_interval(mins => m)) at time zone p_tz end
  from (select coalesce((private.control_slot_deadlines(p_frequency))[least(greatest(p_index, 0), private.control_required(p_frequency) - 1) + 1], 1440) as m) d
$$;

-- next_due_at after an entry at p_at, with p_done regular entries (it included)
-- in its period.
create or replace function private.control_next_due(p_frequency jsonb, p_at timestamptz, p_done integer, p_tz text default 'Europe/Athens')
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  v_unit text := private.control_period_unit(p_frequency);
  v_k integer := case when p_frequency ->> 'interval' ~ '^[0-9]+$' then greatest(1, (p_frequency ->> 'interval')::integer) else 1 end;
  v_local timestamp := p_at at time zone p_tz;
  v_target timestamp;
begin
  if p_frequency ->> 'kind' = 'daily' then
    if coalesce(p_done, 0) < private.control_required(p_frequency) then
      return private.control_slot_deadline(p_frequency, v_local::date, greatest(coalesce(p_done, 0), 0), p_tz);
    end if;
    return private.control_slot_deadline(p_frequency, v_local::date + 1, 0, p_tz);
  end if;
  v_target := case v_unit
    when 'week' then v_local + make_interval(days => 7 * v_k)
    when 'month' then date_trunc('month', v_local) + make_interval(months => v_k)
    when 'year' then date_trunc('year', v_local) + make_interval(years => v_k)
    else v_local + make_interval(days => v_k) end;
  return ((date_trunc(v_unit, v_target) + ('1 ' || v_unit)::interval) at time zone p_tz) - interval '1 second';
end;
$$;

-- last_completed_at and next_due_at of one assignment from its regular entries.
-- With none left (the only one voided), the due date it had before comes back.
create or replace function private.control_refresh_assignment_due(p_assignment_id uuid, p_fallback_due timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_frequency jsonb;
  v_last timestamptz;
  v_done integer;
begin
  select d.frequency_config into v_frequency
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
$$;

create or replace function private.control_executions_period_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
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
  select d.frequency_config into v_frequency from public.control_definitions d where d.id = new.control_id;
  v_frequency := coalesce(v_frequency, '{"kind":"daily","times":["09:00"]}'::jsonb);
  v_start := private.control_period_start(v_frequency, new.performed_at);
  v_end := private.control_period_end(v_frequency, new.performed_at);
  -- Imported history and earlier periods are left alone: the current period,
  -- and for a signed-in caller the last 31 days, are checked.
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
$$;

create or replace function private.control_executions_refresh_due()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.control_refresh_assignment_due(new.assignment_id);
  elsif new.status is distinct from old.status or new.cancelled_at is distinct from old.cancelled_at or new.is_extra is distinct from old.is_extra then
    perform private.control_refresh_assignment_due(new.assignment_id, nullif(old.response_data ->> 'previousNextDueAt', '')::timestamptz);
  end if;
  return null;
end;
$$;

revoke all on function private.control_refresh_assignment_due(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.control_executions_period_guard() from public, anon, authenticated;
revoke all on function private.control_executions_refresh_due() from public, anon, authenticated;

create or replace trigger control_executions_period_guard before insert on public.control_executions
  for each row execute function private.control_executions_period_guard();
create or replace trigger control_executions_refresh_due after insert or update of status, cancelled_at, is_extra on public.control_executions
  for each row execute function private.control_executions_refresh_due();

-- Each regular entry in [p_from, p_to] marked as counted (one of its period's
-- required entries) and on time (by its deadline). Security invoker: the
-- caller's own RLS on control_executions and control_definitions applies.
create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Europe/Athens')
returns table (assignment_id uuid, performed_at timestamptz, counted boolean, on_time boolean)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with defs as (
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

create or replace function public.control_adherence_counts(p_organization_id uuid, p_from timestamptz, p_to timestamptz)
returns table (assignment_id uuid, performed bigint, on_time bigint)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  select m.assignment_id, count(*) filter (where m.counted), count(*) filter (where m.counted and m.on_time)
  from private.control_execution_marks(p_organization_id, p_from, p_to) m
  group by m.assignment_id;
end;
$$;

create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC')
returns table (assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select m.assignment_id, (m.performed_at at time zone p_time_zone) as local_at, not m.on_time as is_late,
           case
             when d.frequency_config ->> 'kind' in ('daily', 'weekly') then true
             when d.frequency_config ->> 'kind' in ('monthly', 'yearly') then false
             else coalesce(case when d.frequency_config ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                then nullif((d.frequency_config ->> 'interval')::numeric, 0) end, 1) < 28
           end as frequent
    from private.control_execution_marks(p_organization_id, make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone), make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_time_zone) - interval '1 microsecond') m
    join public.control_assignments a on a.id = m.assignment_id
    join public.control_definitions d on d.id = a.control_id
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
$$;

-- The current period of every assignment: required entries, regular ones done
-- and extra ones, for «3/4 σήμερα» in the list and the entry screen.
create or replace function public.control_period_progress(p_organization_id uuid)
returns table (assignment_id uuid, required integer, done bigint, extra bigint, period_start timestamptz, period_end timestamptz)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  select a.id, private.control_required(d.frequency_config),
         count(e.id) filter (where not e.is_extra), count(e.id) filter (where e.is_extra),
         b.s, b.e
  from public.control_assignments a
  join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
  cross join lateral (select private.control_period_start(d.frequency_config, now()) as s, private.control_period_end(d.frequency_config, now()) as e) b
  left join public.control_executions e on e.assignment_id = a.id and e.organization_id = a.organization_id
    and e.status <> 'cancelled' and e.cancelled_at is null and e.performed_at >= b.s and e.performed_at < b.e
  where a.organization_id = p_organization_id and a.status <> 'paused'
  group by a.id, d.frequency_config, b.s, b.e;
end;
$$;

revoke all on function private.control_execution_marks(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function private.control_execution_marks(uuid, timestamptz, timestamptz, text) to authenticated;
revoke all on function public.control_period_progress(uuid) from public, anon;
grant execute on function public.control_period_progress(uuid) to authenticated;
