-- The patients table already existed with a read policy (patients_clinical_read)
-- but no way for anyone to create or edit a patient. Add the missing write policy,
-- matching the role set used for sibling clinical tables (surveillance_devices_write).
create policy patients_clinical_write on public.patients
  for all
  using (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))
  with check (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

-- Standard Greek hospital registration fields the UI collects that the table didn't have yet.
alter table public.patients
  add column if not exists father_name text,
  add column if not exists hospital_record_number text,
  add column if not exists sex text,
  add column if not exists notes text;

create unique index if not exists patients_organization_code_idx on public.patients (organization_id, patient_code);
