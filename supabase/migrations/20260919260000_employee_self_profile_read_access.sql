-- "Το προφίλ μου" (My Profile) is supposed to show an employee their own
-- basic details, occupational-health visits, vaccinations and evaluations
-- (src/features/employees/EmployeeRecordPage.jsx selfMode). But none of the
-- employee-domain SELECT policies added in 20260901153852 carry a "read
-- your own row" exception — they only grant org-wide or department-scoped
-- access to HR/Admin/Occupational Health/Infection Control roles. A plain
-- staff member with none of those roles gets zero rows back from
-- `employees`, so the frontend's self-lookup (by employees.user_id) never
-- resolves and "My Profile" falls back to its "no record linked" state
-- even though the employee's own row exists.
--
-- Add a self-read exception, scoped strictly to the requesting user's own
-- linked employee row (employees.user_id = auth.uid()), to: the employees
-- registry itself, and the three clinical/administrative sub-tables whose
-- tabs are shown in self mode (occupational health visits, vaccinations,
-- evaluations). This is read-only — no self exception is added to any
-- insert/update/delete policy, matching the existing "your employee record
-- is read-only" restriction already enforced in the frontend.
--
-- training_records already has this exact self exception
-- (employee_user_id = auth.uid(), see 20260915205707), so the Training tab
-- is unaffected. The Certificates tab uses a separate, generic attachments
-- table (AttachmentField/entityType), not covered by this audit finding.

drop policy if exists employees_select_authorized on public.employees;
create policy employees_select_authorized
on public.employees
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or user_id = auth.uid()
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

drop policy if exists employee_vaccinations_select_authorized on public.employee_vaccinations;
create policy employee_vaccinations_select_authorized
on public.employee_vaccinations
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
  or exists (
    select 1 from public.employees e
    where e.id = employee_vaccinations.employee_id
      and e.organization_id = employee_vaccinations.organization_id
      and e.user_id = auth.uid()
  )
);

drop policy if exists occupational_health_visits_select_authorized on public.occupational_health_visits;
create policy occupational_health_visits_select_authorized
on public.occupational_health_visits
for select
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['occupational_physician'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_occupational_health')
  or exists (
    select 1 from public.employees e
    where e.id = occupational_health_visits.employee_id
      and e.organization_id = occupational_health_visits.organization_id
      and e.user_id = auth.uid()
  )
);

drop policy if exists employee_evaluations_select_authorized on public.employee_evaluations;
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
    select 1 from public.employees e
    where e.id = employee_evaluations.employee_id
      and e.organization_id = employee_evaluations.organization_id
      and e.user_id = auth.uid()
  )
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

comment on policy employees_select_authorized on public.employees is
  'Platform owner; self (own linked account); org-wide Admin/HR/OH/IP lead; department-scoped Department Manager/Link Nurse/Laboratory.';
