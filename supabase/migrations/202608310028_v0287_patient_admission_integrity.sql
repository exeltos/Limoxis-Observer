-- Enforce admission invariants for every writer, not only the application RPC.
-- patients_status_check already comes from v040 and deliberately also permits
-- deceased/transferred. Do not replace or narrow that existing domain rule.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_admissions'::regclass
      and conname = 'patient_admissions_status_check'
  ) then
    alter table public.patient_admissions
      add constraint patient_admissions_status_check
      check (status in ('active', 'discharged'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_admissions'::regclass
      and conname = 'patient_admissions_date_range_check'
  ) then
    alter table public.patient_admissions
      add constraint patient_admissions_date_range_check
      check (discharge_date is null or discharge_date >= admission_date);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patients'::regclass
      and conname = 'patients_admission_date_range_check'
  ) then
    alter table public.patients
      add constraint patients_admission_date_range_check
      check (discharge_date is null or admission_date is null or discharge_date >= admission_date);
  end if;
end $$;

-- Composite foreign keys prevent a patient or department from another tenant
-- being attached to an admission even through a future direct database writer.
create unique index if not exists patients_organization_id_id_idx
  on public.patients (organization_id, id);
create unique index if not exists departments_organization_id_id_idx
  on public.departments (organization_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_admissions'::regclass
      and conname = 'patient_admissions_patient_organization_fk'
  ) then
    alter table public.patient_admissions
      add constraint patient_admissions_patient_organization_fk
      foreign key (organization_id, patient_id)
      references public.patients (organization_id, id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_admissions'::regclass
      and conname = 'patient_admissions_department_organization_fk'
  ) then
    alter table public.patient_admissions
      add constraint patient_admissions_department_organization_fk
      foreign key (organization_id, department_id)
      references public.departments (organization_id, id);
  end if;
end $$;
