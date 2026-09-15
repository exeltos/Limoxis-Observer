-- patient_admissions
drop policy if exists patient_admissions_read on public.patient_admissions;
create policy patient_admissions_read on public.patient_admissions for select to authenticated
  using (
    can_view_surveillance_record(organization_id, department_id)
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])
  );
drop policy if exists patient_admissions_write on public.patient_admissions;
create policy patient_admissions_insert on public.patient_admissions for insert to authenticated
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy patient_admissions_update on public.patient_admissions for update to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy patient_admissions_delete on public.patient_admissions for delete to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));

-- patients
drop policy if exists patients_clinical_read on public.patients;
create policy patients_clinical_read on public.patients for select to authenticated
  using (
    can_view_surveillance_record(organization_id, department_id)
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])
  );
drop policy if exists patients_clinical_write on public.patients;
create policy patients_clinical_insert on public.patients for insert to authenticated
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy patients_clinical_update on public.patients for update to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy patients_clinical_delete on public.patients for delete to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));

-- surveillance_cases
drop policy if exists surveillance_clinical_read on public.surveillance_cases;
create policy surveillance_clinical_read on public.surveillance_cases for select to authenticated
  using (
    can_view_surveillance_record(organization_id, department_id)
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])
  );
drop policy if exists surveillance_cases_write on public.surveillance_cases;
create policy surveillance_cases_insert on public.surveillance_cases for insert to authenticated
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy surveillance_cases_update on public.surveillance_cases for update to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
create policy surveillance_cases_delete on public.surveillance_cases for delete to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));

-- surveillance_events
drop policy if exists surveillance_events_clinical_read on public.surveillance_events;
create policy surveillance_events_clinical_read on public.surveillance_events for select to authenticated
  using (
    exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and can_view_surveillance_record(sc.organization_id, sc.department_id))
    or current_user_is_platform_owner()
    or exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  );
drop policy if exists surveillance_events_write on public.surveillance_events;
create policy surveillance_events_insert on public.surveillance_events for insert to authenticated
  with check (current_user_is_platform_owner() or exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])));
create policy surveillance_events_update on public.surveillance_events for update to authenticated
  using (current_user_is_platform_owner() or exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
  with check (current_user_is_platform_owner() or exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])));
create policy surveillance_events_delete on public.surveillance_events for delete to authenticated
  using (current_user_is_platform_owner() or exists (select 1 from surveillance_cases sc where sc.id = surveillance_events.surveillance_case_id and current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])));

-- surveillance_outcomes
drop policy if exists outcomes_read on public.surveillance_outcomes;
create policy outcomes_read on public.surveillance_outcomes for select to authenticated
  using (
    exists (select 1 from surveillance_cases sc where sc.id = surveillance_outcomes.surveillance_case_id and can_view_surveillance_record(sc.organization_id, sc.department_id))
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role])
  );
drop policy if exists outcomes_write on public.surveillance_outcomes;
create policy outcomes_insert on public.surveillance_outcomes for insert to authenticated
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]));
create policy outcomes_update on public.surveillance_outcomes for update to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]));
create policy outcomes_delete on public.surveillance_outcomes for delete to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]));

-- employee_surveillance_batches
drop policy if exists employee_surveillance_batches_read on public.employee_surveillance_batches;
create policy employee_surveillance_batches_read on public.employee_surveillance_batches for select to authenticated
  using (
    current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'occupational_physician'::app_role])
    or current_user_has_capability(organization_id, 'manage_occupational_health')
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role])
  );
drop policy if exists employee_surveillance_batches_platform_owner_all on public.employee_surveillance_batches;
drop policy if exists employee_surveillance_batches_write on public.employee_surveillance_batches;
create policy employee_surveillance_batches_insert on public.employee_surveillance_batches for insert to public
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy employee_surveillance_batches_update on public.employee_surveillance_batches for update to public
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy employee_surveillance_batches_delete on public.employee_surveillance_batches for delete to public
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));

-- employee_surveillance_records
drop policy if exists employee_surveillance_records_read on public.employee_surveillance_records;
create policy employee_surveillance_records_read on public.employee_surveillance_records for select to authenticated
  using (
    current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'occupational_physician'::app_role])
    or current_user_has_capability(organization_id, 'manage_occupational_health')
    or current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role])
  );
drop policy if exists employee_surveillance_platform_owner_all on public.employee_surveillance_records;
drop policy if exists employee_surveillance_records_write on public.employee_surveillance_records;
create policy employee_surveillance_records_insert on public.employee_surveillance_records for insert to public
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy employee_surveillance_records_update on public.employee_surveillance_records for update to public
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy employee_surveillance_records_delete on public.employee_surveillance_records for delete to public
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['occupational_physician'::app_role]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
