alter table public.waste_measurements
  add column if not exists patient_days integer check (patient_days is null or patient_days >= 0),
  add column if not exists patient_days_source text check (patient_days_source is null or patient_days_source in ('library','manual')),
  add column if not exists responsible_name text;

create or replace function public.current_user_can_read_waste(target_org uuid,target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'view_prevention')
    );
$$;

create or replace function public.current_user_can_write_waste(target_org uuid,target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
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

drop policy if exists waste_read on public.waste_measurements;
create policy waste_read
on public.waste_measurements
for select
using (public.current_user_can_read_waste(organization_id,department_id));

drop policy if exists waste_write on public.waste_measurements;
create policy waste_write
on public.waste_measurements
for all
using (public.current_user_can_write_waste(organization_id,department_id))
with check (public.current_user_can_write_waste(organization_id,department_id));
