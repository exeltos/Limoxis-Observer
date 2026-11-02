-- All the hospital's objectives in one list («Δείκτες & Στόχοι › Στόχοι»), each on a level:
-- the hospital, a department or a committee. An objective is measured in one of three ways:
--   * a department register's indicator (register_id + indicator_key, as before);
--   * an indicator of the platform (platform_indicator_key = indicator_definitions.indicator_key),
--     computed from the hospital's data for the year and for each month;
--   * a value per month, entered by its owner (quality_objective_values).
-- The level is optional: a row without one reads as a department objective when it names a
-- department or a register, a committee objective when it names a committee, else the hospital's.

alter table public.quality_objectives add column if not exists level text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_objectives_level_check') then
    alter table public.quality_objectives add constraint quality_objectives_level_check check (level is null or level in ('hospital','department','committee'));
  end if;
end $$;
alter table public.quality_objectives add column if not exists committee_id uuid references public.committees(id) on delete set null;
alter table public.quality_objectives add column if not exists platform_indicator_key text;
create index if not exists quality_objectives_committee_idx on public.quality_objectives (committee_id);

-- One value per objective and month (the first day of the month).
create table if not exists public.quality_objective_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  objective_id uuid not null references public.quality_objectives(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  value numeric not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (objective_id, month)
);
create index if not exists quality_objective_values_org_idx on public.quality_objective_values (organization_id, objective_id);

alter table public.quality_objective_values enable row level security;
do $policies$
declare
  quality_read text := '(select public.current_user_is_platform_owner())
    or coalesce(organization_id = any ((select private.fast_orgs_role(array[''hospital_admin''::public.app_role,''quality_manager''::public.app_role,''infection_control_lead''::public.app_role]))::uuid[]), false)
    or coalesce(organization_id = any ((select private.fast_orgs_capability(''view_quality''))::uuid[]), false)';
  quality_write text := '(select public.current_user_is_platform_owner())
    or coalesce(organization_id = any ((select private.fast_orgs_role(array[''hospital_admin''::public.app_role,''quality_manager''::public.app_role]))::uuid[]), false)
    or coalesce(organization_id = any ((select private.fast_orgs_capability(''manage_quality''))::uuid[]), false)';
  gate text := '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{quality}''::text[]))::uuid[]))';
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_objective_values' and policyname = 'quality_objective_values_read') then
    execute format('create policy quality_objective_values_read on public.quality_objective_values for select to authenticated using (%s)', quality_read);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_objective_values' and policyname = 'quality_objective_values_manage') then
    execute format('create policy quality_objective_values_manage on public.quality_objective_values for all to authenticated using (%s) with check (%s)', quality_write, quality_write);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_objective_values' and policyname = 'quality_objective_values_module_gate') then
    execute format('create policy quality_objective_values_module_gate on public.quality_objective_values as restrictive for all to authenticated using (%s) with check (%s)', gate, gate);
  end if;
end
$policies$;
grant select, insert, update, delete on public.quality_objective_values to authenticated;

create or replace trigger trg_quality_objective_values_touch before update on public.quality_objective_values
  for each row execute function private.department_register_touch();
