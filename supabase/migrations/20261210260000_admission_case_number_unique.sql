-- The hospital record number («Αριθμός φακέλου») belongs to the admission
-- (patient_admissions.case_number): a patient who comes back after discharge
-- gets a new admission with a new number. Within a hospital a number names one
-- admission only. Existing repeats are left as they are (the owner decides on
-- them); from now on a new or changed number that is already used is refused.

create or replace function private.guard_admission_case_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.case_number, '')), '') is null then
    new.case_number := null;
    return new;
  end if;
  new.case_number := btrim(new.case_number);
  if tg_op = 'UPDATE' and lower(coalesce(old.case_number, '')) = lower(new.case_number) then
    return new;
  end if;
  if exists (
    select 1 from public.patient_admissions a
    where a.organization_id = new.organization_id
      and a.id <> new.id
      and lower(btrim(a.case_number)) = lower(new.case_number)
  ) then
    raise exception 'ADMISSION_CASE_NUMBER_TAKEN' using errcode = '23505';
  end if;
  return new;
end
$$;

create or replace trigger patient_admissions_case_number_guard
  before insert or update of case_number on public.patient_admissions
  for each row execute function private.guard_admission_case_number();

-- The first admission made with a new patient carries the record number entered with the patient.
create or replace function public.create_initial_patient_admission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  insert into public.patient_admissions (
    organization_id, patient_id, department_id, admission_date,
    discharge_date, status, notes, created_by, case_number
  ) values (
    new.organization_id, new.id, new.department_id, new.admission_date,
    new.discharge_date, new.status, new.notes, auth.uid(), nullif(btrim(coalesce(new.hospital_record_number, '')), '')
  );
  return new;
end;
$$;

-- Sets the record number of an admission the caller has just created (the
-- department managers who may create admissions cannot update the table).
create or replace function private.set_new_admission_case_number(p_organization_id uuid, p_admission_id uuid, p_case_number text)
returns public.patient_admissions
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.patient_admissions%rowtype;
begin
  update public.patient_admissions set case_number = p_case_number
  where id = p_admission_id and organization_id = p_organization_id and created_by = auth.uid()
  returning * into v_row;
  if not found then raise exception 'admission not found'; end if;
  return v_row;
end
$$;

grant execute on function private.set_new_admission_case_number(uuid, uuid, text) to authenticated;

-- A new admission with its record number, in one call: the existing checked RPC
-- creates it, then the number is set (the guard above refuses a number already
-- used, and the whole call is undone).
create or replace function public.create_patient_admission_numbered(
  p_organization_id uuid, p_patient_id uuid, p_department_id uuid, p_admission_date date,
  p_case_number text, p_discharge_date date default null, p_status text default 'active', p_notes text default null
)
returns public.patient_admissions
language plpgsql
security invoker
set search_path = ''
as $$
declare v_created public.patient_admissions%rowtype;
begin
  v_created := public.create_patient_admission(p_organization_id, p_patient_id, p_department_id, p_admission_date, p_discharge_date, p_status, p_notes);
  if nullif(btrim(coalesce(p_case_number, '')), '') is not null then
    v_created := private.set_new_admission_case_number(p_organization_id, v_created.id, p_case_number);
  end if;
  return v_created;
end
$$;

grant execute on function public.create_patient_admission_numbered(uuid, uuid, uuid, date, text, date, text, text) to authenticated;
