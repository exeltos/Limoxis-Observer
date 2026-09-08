-- Canonical bridge: every patient/employee surveillance creates a laboratory work item.
-- Environmental surveillance is already stored directly in laboratory_samples.

create or replace function public.create_patient_surveillance_laboratory_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if exists (
    select 1 from public.laboratory_samples ls
    where ls.organization_id = new.organization_id
      and ls.surveillance_case_id = new.id
  ) then
    return new;
  end if;

  select patient_code, first_name, last_name
  into p
  from public.patients
  where id = new.patient_id;

  insert into public.laboratory_samples (
    organization_id, patient_id, surveillance_case_id, department_id,
    sample_code, sample_type, source_site, requested_at, requested_by,
    status, priority, created_by,
    subject_type, subject_name, subject_code
  ) values (
    new.organization_id, new.patient_id, new.id, new.department_id,
    'LAB-SUR-' || replace(new.id::text,'-',''), 'surveillance', 'Surveillance',
    coalesce(new.started_at, now()), new.created_by,
    'requested', 'routine', new.created_by,
    'patient', trim(concat_ws(' ', p.first_name, p.last_name)), p.patient_code
  );

  return new;
end;
$$;

create or replace function public.create_employee_surveillance_laboratory_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  if exists (
    select 1 from public.laboratory_samples ls
    where ls.organization_id = new.organization_id
      and ls.employee_surveillance_id = new.id
  ) then
    return new;
  end if;

  select employee_code, first_name, last_name, department_id
  into e
  from public.employees
  where id = new.employee_id;

  insert into public.laboratory_samples (
    organization_id, patient_id, surveillance_case_id, department_id,
    sample_code, sample_type, source_site, requested_at, requested_by,
    status, priority, created_by,
    subject_type, subject_name, subject_code,
    employee_surveillance_id, employee_surveillance_batch_id
  ) values (
    new.organization_id, null, null, e.department_id,
    'LAB-EMP-' || replace(new.id::text,'-',''), 'surveillance', array_to_string(new.screening_types, ', '),
    coalesce(new.started_at, now()), new.created_by,
    'requested', 'routine', new.created_by,
    'employee', trim(concat_ws(' ', e.last_name, e.first_name)), e.employee_code,
    new.id, new.batch_id
  );

  return new;
end;
$$;

drop trigger if exists surveillance_cases_create_laboratory_item on public.surveillance_cases;
create trigger surveillance_cases_create_laboratory_item
after insert on public.surveillance_cases
for each row execute function public.create_patient_surveillance_laboratory_item();

drop trigger if exists employee_surveillance_create_laboratory_item on public.employee_surveillance_records;
create trigger employee_surveillance_create_laboratory_item
after insert on public.employee_surveillance_records
for each row execute function public.create_employee_surveillance_laboratory_item();

-- Backfill existing patient surveillance records that predate the bridge.
insert into public.laboratory_samples (
  organization_id, patient_id, surveillance_case_id, department_id,
  sample_code, sample_type, source_site, requested_at, requested_by,
  status, priority, created_by,
  subject_type, subject_name, subject_code
)
select
  sc.organization_id, sc.patient_id, sc.id, sc.department_id,
  'LAB-SUR-' || replace(sc.id::text,'-',''), 'surveillance', 'Surveillance',
  coalesce(sc.started_at, sc.created_at), sc.created_by,
  'requested', 'routine', sc.created_by,
  'patient', trim(concat_ws(' ', p.first_name, p.last_name)), p.patient_code
from public.surveillance_cases sc
join public.patients p on p.id = sc.patient_id
where not exists (
  select 1 from public.laboratory_samples ls
  where ls.organization_id = sc.organization_id
    and ls.surveillance_case_id = sc.id
);

-- Backfill existing employee surveillance records, including records that belong to a bulk batch.
insert into public.laboratory_samples (
  organization_id, patient_id, surveillance_case_id, department_id,
  sample_code, sample_type, source_site, requested_at, requested_by,
  status, priority, created_by,
  subject_type, subject_name, subject_code,
  employee_surveillance_id, employee_surveillance_batch_id
)
select
  er.organization_id, null, null, e.department_id,
  'LAB-EMP-' || replace(er.id::text,'-',''), 'surveillance', array_to_string(er.screening_types, ', '),
  coalesce(er.started_at, er.created_at), er.created_by,
  'requested', 'routine', er.created_by,
  'employee', trim(concat_ws(' ', e.last_name, e.first_name)), e.employee_code,
  er.id, er.batch_id
from public.employee_surveillance_records er
join public.employees e on e.id = er.employee_id
where not exists (
  select 1 from public.laboratory_samples ls
  where ls.organization_id = er.organization_id
    and ls.employee_surveillance_id = er.id
);
