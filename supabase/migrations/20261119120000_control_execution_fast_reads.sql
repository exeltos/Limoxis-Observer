-- Controls: the screens no longer download every execution. An organisation
-- imported from FileMaker has 184,000 executions; the controls service used to
-- read them all in one request (cut at the API's 1,000-row cap, so most of the
-- history silently went missing) and counted in the browser. Now:
--
-- public.control_assignment_summary(org, today_from)
--     per assignment (voided entries left out): executions recorded, today's,
--     findings, the latest one.
-- public.control_adherence_counts(org, from, to)
--     per assignment: executions done in the period and how many were on time
--     (the same rules as controlAdherence.js: from the control's creation,
--     never after now, 2 hours' grace for daily controls and 1 day otherwise).
-- public.control_calendar_months(org, year, time_zone)
--     per assignment and month of the year: done, late and, for infrequent
--     controls (monthly, yearly, every 28+ days), the days they were done on.
--
-- They are PL/pgSQL with plan_cache_mode = force_custom_plan so each call is
-- planned with its organisation and dates (a generic plan scanned the whole
-- table: 600 ms against 20-40 ms).
-- All three are SECURITY INVOKER: they read through the tables' own row level
-- security (control_executions_read, control_definitions_read), so a caller
-- sees the same rows as with a direct select. History lists read pages of
-- control_executions by assignment and date (indexes below).

create index if not exists control_executions_org_performed_idx
  on public.control_executions (organization_id, performed_at desc);
create index if not exists control_executions_assignment_performed_idx
  on public.control_executions (assignment_id, performed_at desc);
create index if not exists control_executions_org_finding_idx
  on public.control_executions (organization_id, performed_at desc) where has_finding;
-- Covers the per-assignment summary (an index-only scan, RLS columns included).
create index if not exists control_executions_summary_idx
  on public.control_executions (organization_id, assignment_id) include (performed_at, status, has_finding, department_id);

create or replace function public.control_assignment_summary(p_organization_id uuid, p_today_from timestamptz default null)
returns table (assignment_id uuid, executions bigint, today bigint, findings bigint, last_performed_at timestamptz)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  select e.assignment_id,
         count(*) filter (where e.status <> 'cancelled'),
         count(*) filter (where e.status <> 'cancelled' and e.performed_at >= coalesce(p_today_from, date_trunc('day', now()))),
         count(*) filter (where e.status <> 'cancelled' and e.has_finding),
         max(e.performed_at) filter (where e.status <> 'cancelled')
  from public.control_executions e
  where e.organization_id = p_organization_id
  group by e.assignment_id;
end;
$$;

create or replace function public.control_adherence_counts(p_organization_id uuid, p_from timestamptz, p_to timestamptz)
returns table (assignment_id uuid, performed bigint, on_time bigint)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  select e.assignment_id,
         count(*),
         count(*) filter (where x.due is null or e.performed_at - x.due <= x.grace)
  from public.control_executions e
  join public.control_definitions d on d.id = e.control_id and d.organization_id = e.organization_id
  cross join lateral (
    select nullif(e.response_data ->> 'previousNextDueAt', '')::timestamptz as due,
           case when d.frequency_config ->> 'kind' = 'daily' then interval '2 hours' else interval '1 day' end as grace
  ) x
  where e.organization_id = p_organization_id
    and e.status <> 'cancelled' and e.cancelled_at is null
    and e.performed_at >= greatest(p_from, d.created_at)
    and e.performed_at <= least(p_to, now())
  group by e.assignment_id;
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
    select e.assignment_id,
           (e.performed_at at time zone p_time_zone) as local_at,
           coalesce(nullif(e.response_data ->> 'previousNextDueAt', '')::timestamptz is not null
             and e.performed_at - nullif(e.response_data ->> 'previousNextDueAt', '')::timestamptz
               > case when d.frequency_config ->> 'kind' = 'daily' then interval '2 hours' else interval '1 day' end, false) as is_late,
           case
             when d.frequency_config ->> 'kind' in ('daily', 'weekly') then true
             when d.frequency_config ->> 'kind' in ('monthly', 'yearly') then false
             else coalesce(case when d.frequency_config ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                then nullif((d.frequency_config ->> 'interval')::numeric, 0) end, 1) < 28
           end as frequent
    from public.control_executions e
    join public.control_definitions d on d.id = e.control_id and d.organization_id = e.organization_id
    where e.organization_id = p_organization_id
      and e.status <> 'cancelled' and e.cancelled_at is null
      and e.performed_at >= make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone)
      and e.performed_at < make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_time_zone)
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

revoke all on function public.control_assignment_summary(uuid, timestamptz) from public, anon;
revoke all on function public.control_adherence_counts(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.control_calendar_months(uuid, integer, text) from public, anon;
grant execute on function public.control_assignment_summary(uuid, timestamptz) to authenticated;
grant execute on function public.control_adherence_counts(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.control_calendar_months(uuid, integer, text) to authenticated;
