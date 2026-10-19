-- Controls: faster reads for the programme, the record and the bell.
--
-- 1. control_period_progress (Controls list, programme and every control
--    record). Under row level security the period bounds, computed by
--    non-leakproof functions, could not reach the index on the executions:
--    every execution of the organisation was read and the bounds were
--    worked out again for each row (about 13 s for a hospital with ~185k
--    entries). The bounds are now worked out once per assignment and the
--    current period is counted through control_executions_assignment_performed_idx
--    (about 0.3 s). Same signature, same rows.
--
-- 2. The expiry checks (Controls programme, the bell) read the entries that
--    carry an item list. A partial index holds just those entries, so the read
--    no longer walks every entry of the expiry controls.

create or replace function public.control_period_progress(p_organization_id uuid)
returns table (assignment_id uuid, required integer, done bigint, extra bigint, period_start timestamptz, period_end timestamptz)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with periods as materialized (
    select a.id, a.organization_id,
           private.control_required(d.frequency_config) as req,
           private.control_period_start(d.frequency_config, now()) as s,
           private.control_period_end(d.frequency_config, now()) as e
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
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
$$;

revoke all on function public.control_period_progress(uuid) from public, anon;
grant execute on function public.control_period_progress(uuid) to authenticated;

create index if not exists control_executions_item_lists_idx
  on public.control_executions (organization_id, control_id, performed_at desc)
  where (response_data -> 'structuredData' -> 'rows') is not null;
