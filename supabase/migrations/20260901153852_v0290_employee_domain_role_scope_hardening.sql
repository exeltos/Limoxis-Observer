-- Limoxis Observer v0.29.0
-- Employee domain authorization hardening.
-- Goals:
-- 1) authenticated-only policies
-- 2) explicit SELECT / INSERT / UPDATE / DELETE separation
-- 3) organization-wide access for Platform Owner, Hospital Admin, HR, Occupational Physician, Infection Control Lead
-- 4) department-scoped read access for Department Manager, Link Nurse, Laboratory
-- 5) strict occupational-health privacy

alter table public.employees enable row level security;
alter table public.employee_training_summary enable row level security;
alter table public.employee_evaluations enable row level security;
alter table public.employee_certificates enable row level security;
alter table public.employee_vaccinations enable row level security;
alter table public.occupational_health_visits enable row level security;

-- Remove legacy broad PUBLIC / ALL policies.
drop policy if exists employees_read on public.employees;
drop policy if exists employees_write on public.employees;
drop policy if exists employee_training_summary_read on public.employee_training_summary;
drop policy if exists employee_training_summary_write on public.employee_training_summary;
drop policy if exists employee_evaluations_read on public.employee_evaluations;
drop policy if exists employee_evaluations_write on public.employee_evaluations;
drop policy if exists employee_certificates_read on public.employee_certificates;
drop policy if exists employee_certificates_write on public.employee_certificates;
drop policy if exists employee_vaccinations_read on public.employee_vaccinations;
drop policy if exists employee_vaccinations_write on public.employee_vaccinations;
drop policy if exists occupational_visits_read on public.occupational_health_visits;
drop policy if exists occupational_visits_write on public.occupational_health_visits;

-- ---------------------------------------------------------------------------
-- EMPLOYEES: registry / demographic / organizational data
-- ---------------------------------------------------------------------------
create policy employees_select_authorized
on public.employees
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::public.app_role,
      'hr_office'::public.app_role,
      'occupational_physician'::public.app_role,
      'infection_control_lead'::public.app_role
    ]
  )
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array[
        'department_manager'::public.app_role,
        'link_nurse'::public.app_role,
        'laboratory'::public.app_role
      ]
    )
    and public.current_user_has_department_scope(organization_id, department_id)
  )
);

create policy employees_insert_authorized
on public.employees
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employees_update_authorized
on public.employees
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employees_delete_authorized
on public.employees
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

-- ---------------------------------------------------------------------------
-- Non-clinical employee subrecords: training, evaluations, certificates.
-- Same org-wide readers as registry plus department-scoped operational readers.
-- Writes remain HR/Admin governed.
-- ---------------------------------------------------------------------------
create policy employee_training_summary_select_authorized
on public.employee_training_summary
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::public.app_role,
      'hr_office'::public.app_role,
      'occupational_physician'::public.app_role,
      'infection_control_lead'::public.app_role
    ]
  )
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or exists (
    select 1
    from public.employees e
    where e.id = employee_training_summary.employee_id
      and e.organization_id = employee_training_summary.organization_id
      and e.department_id is not null
      and public.current_user_has_org_role(
        employee_training_summary.organization_id,
        array['department_manager'::public.app_role,'link_nurse'::public.app_role,'laboratory'::public.app_role]
      )
      and public.current_user_has_department_scope(employee_training_summary.organization_id, e.department_id)
  )
);

create policy employee_training_summary_insert_authorized
on public.employee_training_summary
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_training_summary_update_authorized
on public.employee_training_summary
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_training_summary_delete_authorized
on public.employee_training_summary
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_evaluations_select_authorized
on public.employee_evaluations
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::public.app_role,
      'hr_office'::public.app_role,
      'occupational_physician'::public.app_role,
      'infection_control_lead'::public.app_role
    ]
  )
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or exists (
    select 1
    from public.employees e
    where e.id = employee_evaluations.employee_id
      and e.organization_id = employee_evaluations.organization_id
      and e.department_id is not null
      and public.current_user_has_org_role(
        employee_evaluations.organization_id,
        array['department_manager'::public.app_role,'link_nurse'::public.app_role,'laboratory'::public.app_role]
      )
      and public.current_user_has_department_scope(employee_evaluations.organization_id, e.department_id)
  )
);

create policy employee_evaluations_insert_authorized
on public.employee_evaluations
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_evaluations_update_authorized
on public.employee_evaluations
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_evaluations_delete_authorized
on public.employee_evaluations
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_certificates_select_authorized
on public.employee_certificates
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::public.app_role,
      'hr_office'::public.app_role,
      'occupational_physician'::public.app_role,
      'infection_control_lead'::public.app_role
    ]
  )
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or exists (
    select 1
    from public.employees e
    where e.id = employee_certificates.employee_id
      and e.organization_id = employee_certificates.organization_id
      and e.department_id is not null
      and public.current_user_has_org_role(
        employee_certificates.organization_id,
        array['department_manager'::public.app_role,'link_nurse'::public.app_role,'laboratory'::public.app_role]
      )
      and public.current_user_has_department_scope(employee_certificates.organization_id, e.department_id)
  )
);

create policy employee_certificates_insert_authorized
on public.employee_certificates
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_certificates_update_authorized
on public.employee_certificates
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

create policy employee_certificates_delete_authorized
on public.employee_certificates
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
);

-- ---------------------------------------------------------------------------
-- Vaccinations: occupational-health clinical data.
-- No HR/Admin/department implicit read. Only Platform Owner and explicit OH authority.
-- ---------------------------------------------------------------------------
create policy employee_vaccinations_select_authorized
on public.employee_vaccinations
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy employee_vaccinations_insert_authorized
on public.employee_vaccinations
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy employee_vaccinations_update_authorized
on public.employee_vaccinations
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
)
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy employee_vaccinations_delete_authorized
on public.employee_vaccinations
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

-- ---------------------------------------------------------------------------
-- Occupational physician visits: highest privacy tier in employee domain.
-- ---------------------------------------------------------------------------
create policy occupational_health_visits_select_authorized
on public.occupational_health_visits
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy occupational_health_visits_insert_authorized
on public.occupational_health_visits
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy occupational_health_visits_update_authorized
on public.occupational_health_visits
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
)
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy occupational_health_visits_delete_authorized
on public.occupational_health_visits
for delete
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
);

-- Ensure the scope lookup used by department-scoped policies is indexed both ways.
create index if not exists organization_member_scopes_department_membership_idx
  on public.organization_member_scopes (department_id, membership_id);

comment on policy employees_select_authorized on public.employees is
  'Platform owner; org-wide Admin/HR/OH/IP lead; department-scoped Department Manager/Link Nurse/Laboratory.';
comment on policy occupational_health_visits_select_authorized on public.occupational_health_visits is
  'Restricted occupational-health clinical data: Platform Owner or explicit occupational-health authority only.';
