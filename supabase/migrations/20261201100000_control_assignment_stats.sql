-- Controls: control_assignment_summary no longer groups every execution of the
-- organisation each time the registry opens (184,000 rows: 90 ms warm, over 2 s
-- cold). A trigger on control_executions keeps the per-assignment totals in
-- public.control_assignment_stats (one row per organisation, assignment and
-- department, the department being the column control_executions_read checks),
-- and the summary reads those rows; only today's count is still counted, from
-- today's executions alone (control_executions_org_performed_idx).
--
-- The counting rules are the summary's: voided entries (status 'cancelled') are
-- left out; findings are the valid entries with has_finding; the latest is the
-- latest valid performed_at. Insert, update (void, edit, move) and delete keep
-- the row in step; when the latest entry goes away the latest is read again
-- from control_executions_assignment_performed_idx.
--
-- Rows are read through the same rule as control_executions_read, so a caller
-- sees the totals of the executions they could select. Nobody writes the table
-- directly (no write policy); the trigger function is SECURITY DEFINER.

lock table public.control_executions in share row exclusive mode;

create table if not exists public.control_assignment_stats (
  organization_id uuid not null,
  assignment_id uuid not null,
  department_id uuid not null,
  executions bigint not null default 0,
  findings bigint not null default 0,
  last_performed_at timestamptz,
  primary key (organization_id, assignment_id, department_id)
);

alter table public.control_assignment_stats enable row level security;

create policy control_assignment_stats_read on public.control_assignment_stats for select to authenticated
using ((( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((organization_id = ANY (( SELECT private.fast_orgs_capability('view_controls'::text) AS fast_orgs_capability)::uuid[])), false)) AND (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'laboratory'::app_role, 'quality_manager'::app_role]) AS fast_orgs_role)::uuid[])), false) OR ((department_id IS NOT NULL) AND COALESCE(((((organization_id)::text || ':'::text) || (department_id)::text) = ANY (( SELECT private.current_user_department_scopes() AS current_user_department_scopes)::text[])), false)))));

create or replace function private.control_assignment_stats_apply()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_valid boolean := tg_op <> 'INSERT' and old.status <> 'cancelled';
  new_valid boolean := tg_op <> 'DELETE' and new.status <> 'cancelled';
begin
  if tg_op = 'UPDATE'
     and old.organization_id = new.organization_id and old.assignment_id = new.assignment_id
     and old.department_id = new.department_id and old_valid = new_valid
     and old.has_finding = new.has_finding and old.performed_at = new.performed_at then
    return null;
  end if;
  if old_valid then
    update public.control_assignment_stats s
       set executions = s.executions - 1,
           findings = s.findings - case when old.has_finding then 1 else 0 end
     where s.organization_id = old.organization_id and s.assignment_id = old.assignment_id and s.department_id = old.department_id;
  end if;
  if new_valid or tg_op = 'INSERT' then
    insert into public.control_assignment_stats as s (organization_id, assignment_id, department_id, executions, findings, last_performed_at)
    values (new.organization_id, new.assignment_id, new.department_id,
            case when new_valid then 1 else 0 end,
            case when new_valid and new.has_finding then 1 else 0 end,
            case when new_valid then new.performed_at end)
    on conflict (organization_id, assignment_id, department_id) do update
      set executions = s.executions + excluded.executions,
          findings = s.findings + excluded.findings,
          last_performed_at = greatest(s.last_performed_at, excluded.last_performed_at);
  end if;
  if old_valid then
    -- The entry that went away (or moved) may have been the latest.
    update public.control_assignment_stats s
       set last_performed_at = (select max(e.performed_at) from public.control_executions e
                                 where e.assignment_id = s.assignment_id and e.organization_id = s.organization_id
                                   and e.department_id = s.department_id and e.status <> 'cancelled')
     where s.organization_id = old.organization_id and s.assignment_id = old.assignment_id and s.department_id = old.department_id
       and s.last_performed_at <= old.performed_at;
  end if;
  if tg_op <> 'INSERT' then
    -- No entries left in the old group: no row, as the grouped count had none.
    delete from public.control_assignment_stats s
     where s.organization_id = old.organization_id and s.assignment_id = old.assignment_id and s.department_id = old.department_id
       and not exists (select 1 from public.control_executions e
                        where e.organization_id = old.organization_id and e.assignment_id = old.assignment_id and e.department_id = old.department_id);
  end if;
  return null;
end;
$$;

create trigger control_executions_assignment_stats
  after insert or update or delete on public.control_executions
  for each row execute function private.control_assignment_stats_apply();

insert into public.control_assignment_stats (organization_id, assignment_id, department_id, executions, findings, last_performed_at)
select e.organization_id, e.assignment_id, e.department_id,
       count(*) filter (where e.status <> 'cancelled'),
       count(*) filter (where e.status <> 'cancelled' and e.has_finding),
       max(e.performed_at) filter (where e.status <> 'cancelled')
from public.control_executions e
group by e.organization_id, e.assignment_id, e.department_id
on conflict (organization_id, assignment_id, department_id) do nothing;

create or replace function public.control_assignment_summary(p_organization_id uuid, p_today_from timestamptz default null)
returns table (assignment_id uuid, executions bigint, today bigint, findings bigint, last_performed_at timestamptz)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with totals as (
    select s.assignment_id, sum(s.executions)::bigint as executions, sum(s.findings)::bigint as findings, max(s.last_performed_at) as last_performed_at
    from public.control_assignment_stats s
    where s.organization_id = p_organization_id
    group by s.assignment_id
  ), today as (
    select e.assignment_id, count(*) as today
    from public.control_executions e
    where e.organization_id = p_organization_id
      and e.performed_at >= coalesce(p_today_from, date_trunc('day', now()))
      and e.status <> 'cancelled'
    group by e.assignment_id
  )
  select t.assignment_id, t.executions, coalesce(d.today, 0)::bigint, t.findings, t.last_performed_at
  from totals t
  left join today d on d.assignment_id = t.assignment_id;
end;
$$;
