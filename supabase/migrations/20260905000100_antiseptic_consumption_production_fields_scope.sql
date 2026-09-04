alter table public.antiseptic_consumption_periods
  add column if not exists patient_days integer,
  add column if not exists patient_days_source text,
  add column if not exists responsible_name text;

alter table public.antiseptic_consumption_periods
  drop constraint if exists antiseptic_consumption_periods_source_check;

alter table public.antiseptic_consumption_periods
  add constraint antiseptic_consumption_periods_source_check
  check (source in ('manual','imported','pharmacy_issue','warehouse_issue','stock_difference','direct_measurement','other'));

alter table public.antiseptic_consumption_periods
  drop constraint if exists antiseptic_consumption_periods_patient_days_check;
alter table public.antiseptic_consumption_periods
  add constraint antiseptic_consumption_periods_patient_days_check
  check (patient_days is null or patient_days >= 0);

create or replace function public.current_user_can_read_antiseptic(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'view_prevention')
    );
$$;

create or replace function public.current_user_can_write_antiseptic(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_antiseptic')
    );
$$;

drop policy if exists antiseptic_read on public.antiseptic_consumption_periods;
create policy antiseptic_read on public.antiseptic_consumption_periods for select
using (public.current_user_can_read_antiseptic(organization_id,department_id));

drop policy if exists antiseptic_write on public.antiseptic_consumption_periods;
create policy antiseptic_write on public.antiseptic_consumption_periods for all
using (public.current_user_can_write_antiseptic(organization_id,department_id))
with check (public.current_user_can_write_antiseptic(organization_id,department_id));
