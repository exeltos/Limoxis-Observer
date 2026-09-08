-- Link every surveillance domain to the canonical laboratory workflow.
-- Patient surveillance keeps the existing surveillance_case_id FK.
-- Employee surveillance uses typed links so laboratory records can be opened
-- directly from the surveillance registry without inventing a separate detail card.

alter table public.laboratory_samples
  add column if not exists subject_type text,
  add column if not exists subject_name text,
  add column if not exists subject_code text,
  add column if not exists employee_surveillance_id uuid references public.employee_surveillance_records(id) on delete set null,
  add column if not exists employee_surveillance_batch_id uuid references public.employee_surveillance_batches(id) on delete set null;

update public.laboratory_samples
set subject_type = case
  when patient_id is not null then 'patient'
  when lower(sample_type) in ('water','surface','environment','environmental','νερό','επιφάνεια','επιφανεια') then 'environment'
  else 'other'
end
where subject_type is null;

alter table public.laboratory_samples
  drop constraint if exists laboratory_samples_subject_type_check;

alter table public.laboratory_samples
  add constraint laboratory_samples_subject_type_check
  check (subject_type is null or subject_type in ('patient','employee','employee_batch','environment','other'));

create index if not exists laboratory_samples_employee_surveillance_idx
  on public.laboratory_samples (organization_id, employee_surveillance_id)
  where employee_surveillance_id is not null;

create index if not exists laboratory_samples_employee_surveillance_batch_idx
  on public.laboratory_samples (organization_id, employee_surveillance_batch_id)
  where employee_surveillance_batch_id is not null;

comment on column public.laboratory_samples.subject_type is
  'Surveillance subject domain: patient, employee, employee_batch, environment or other.';
comment on column public.laboratory_samples.subject_name is
  'Snapshot display name for non-patient laboratory subjects.';
comment on column public.laboratory_samples.subject_code is
  'Snapshot business code for the laboratory subject.';
