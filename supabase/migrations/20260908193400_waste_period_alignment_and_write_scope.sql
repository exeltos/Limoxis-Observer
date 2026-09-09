-- Limoxis Observer — Waste denominator/period alignment and operational write scope

alter table public.waste_measurements
  add column if not exists period_start date,
  add column if not exists period_end date;

update public.waste_measurements
set period_start = coalesce(period_start, record_date),
    period_end = coalesce(period_end, record_date)
where period_start is null or period_end is null;

alter table public.waste_measurements
  alter column period_start set not null,
  alter column period_end set not null;

alter table public.waste_measurements
  drop constraint if exists waste_measurements_period_order_check;

alter table public.waste_measurements
  add constraint waste_measurements_period_order_check
  check (period_end >= period_start);

-- Hospital Admin keeps broad read access through current_user_can_read_waste,
-- but operational waste writes require an operational Prevention role/capability.
create or replace function public.current_user_can_write_waste(target_org uuid,target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and (
        public.current_user_has_capability(target_org,'record_waste')
        or public.current_user_has_capability(target_org,'waste_management')
      )
    );
$$;
