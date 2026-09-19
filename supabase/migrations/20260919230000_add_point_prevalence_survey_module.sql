-- ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.2 (Σημειακός Επιπολασμός Λοιμώξεων &
-- Χρήσης Αντιβιοτικών / ECDC Point Prevalence Survey protocol): on a
-- single "snapshot" day (or short campaign), record the total number of
-- inpatients, how many have an active HAI, and how many are on
-- antibiotic therapy. Two indicators follow from the same record:
-- HAI prevalence and antibiotic-use prevalence, each (numerator ÷
-- patients that day) × 100. This is the sixth and final module from the
-- ΕΟΔΥ legal-indicator gap analysis; no data model existed for it at all.

create table public.point_prevalence_surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  survey_date date not null,
  patients_total integer not null check (patients_total >= 0),
  patients_with_hai integer not null check (patients_with_hai >= 0 and patients_with_hai <= patients_total),
  patients_on_antibiotics integer not null check (patients_on_antibiotics >= 0 and patients_on_antibiotics <= patients_total),
  responsible_name text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_point_prevalence_surveys_org_date on public.point_prevalence_surveys (organization_id, survey_date desc);
create index idx_point_prevalence_surveys_department on public.point_prevalence_surveys (department_id);

alter table public.point_prevalence_surveys enable row level security;

create or replace function public.current_user_can_read_prevalence_survey(target_org uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_prevalence_survey')
    );
$$;

create or replace function public.current_user_can_write_prevalence_survey(target_org uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_prevalence_survey')
    );
$$;

revoke all on function public.current_user_can_read_prevalence_survey(uuid,uuid) from public,anon;
revoke all on function public.current_user_can_write_prevalence_survey(uuid,uuid) from public,anon;
grant execute on function public.current_user_can_read_prevalence_survey(uuid,uuid) to authenticated;
grant execute on function public.current_user_can_write_prevalence_survey(uuid,uuid) to authenticated;

create policy prevalence_survey_read on public.point_prevalence_surveys for select
  using (public.current_user_can_read_prevalence_survey(organization_id, department_id));
create policy prevalence_survey_insert on public.point_prevalence_surveys for insert
  with check (public.current_user_can_write_prevalence_survey(organization_id, department_id));
create policy prevalence_survey_update on public.point_prevalence_surveys for update
  using (public.current_user_can_write_prevalence_survey(organization_id, department_id))
  with check (public.current_user_can_write_prevalence_survey(organization_id, department_id));
create policy prevalence_survey_delete on public.point_prevalence_surveys for delete
  using (public.current_user_can_write_prevalence_survey(organization_id, department_id));

revoke all on public.point_prevalence_surveys from public, anon;
grant select, insert, update, delete on public.point_prevalence_surveys to authenticated;

create trigger trg_audit_point_prevalence_surveys
after insert or update or delete on public.point_prevalence_surveys
for each row execute function private.audit_management_change();

create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
      and om.role = 'hospital_admin'
      and capability_key not in ('view_platform','manage_platform','view_occupational_health','manage_occupational_health')
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=capability_key
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and capability_key='view_lab')
              or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
            )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager')
          when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
          when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          else false
        end
      )
  );
$$;

revoke all on function public.current_user_has_capability(uuid,text) from public;
grant execute on function public.current_user_has_capability(uuid,text) to authenticated;
