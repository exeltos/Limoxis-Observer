-- Create an admission and refresh the patient's current-admission snapshot in
-- one database transaction. Any exception rolls both writes back.
insert into public.patient_admissions (
  organization_id, patient_id, department_id, admission_date,
  discharge_date, status, notes, created_by, created_at, updated_at
)
select
  p.organization_id, p.id, p.department_id, p.admission_date,
  p.discharge_date, p.status, p.notes, p.created_by, p.created_at, p.updated_at
from public.patients p
where p.admission_date is not null
  and not exists (
    select 1 from public.patient_admissions a where a.patient_id = p.id
  );

create or replace function public.create_initial_patient_admission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.patient_admissions (
    organization_id, patient_id, department_id, admission_date,
    discharge_date, status, notes, created_by
  ) values (
    new.organization_id, new.id, new.department_id, new.admission_date,
    new.discharge_date, new.status, new.notes, auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists patients_create_initial_admission on public.patients;
create trigger patients_create_initial_admission
after insert on public.patients
for each row when (new.admission_date is not null)
execute function public.create_initial_patient_admission();

create or replace function public.create_patient_admission(
  p_organization_id uuid,
  p_patient_id uuid,
  p_department_id uuid,
  p_admission_date date,
  p_discharge_date date default null,
  p_status text default 'active',
  p_notes text default null
)
returns public.patient_admissions
language plpgsql
set search_path = public
as $$
declare
  created_admission public.patient_admissions;
  updated_patient_count integer;
begin
  if p_organization_id is null or p_patient_id is null or p_admission_date is null then
    raise exception 'organization, patient, and admission date are required';
  end if;
  if p_status not in ('active', 'discharged') then
    raise exception 'invalid admission status: %', p_status;
  end if;
  if p_discharge_date is not null and p_discharge_date < p_admission_date then
    raise exception 'discharge date cannot precede admission date';
  end if;

  insert into public.patient_admissions (
    organization_id, patient_id, department_id, admission_date,
    discharge_date, status, notes, created_by
  ) values (
    p_organization_id, p_patient_id, p_department_id, p_admission_date,
    p_discharge_date, p_status, p_notes, auth.uid()
  ) returning * into created_admission;

  update public.patients
  set department_id = p_department_id,
      admission_date = p_admission_date,
      discharge_date = p_discharge_date,
      status = p_status,
      updated_at = now()
  where id = p_patient_id and organization_id = p_organization_id;

  get diagnostics updated_patient_count = row_count;
  if updated_patient_count <> 1 then
    raise exception 'patient does not belong to organization';
  end if;
  return created_admission;
end;
$$;

revoke all on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) from public;
grant execute on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) to authenticated;
