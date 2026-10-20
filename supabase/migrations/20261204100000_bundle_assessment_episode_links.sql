-- Φόρμες & ερωτηματολόγια, βήμα 1: ο έλεγχος δέσμης πρόληψης συνδέεται με τον ασθενή, το
-- επεισόδιο επιτήρησης και τη συσκευή. Μόνο προσθήκες: οι στήλες είναι nullable, οι
-- σημερινοί έλεγχοι ανά τμήμα (/prevention) δουλεύουν όπως πριν.
--
-- Η σύνδεση με ασθενή βλέπεται μόνο από όποιον βλέπει την επιτήρηση: restrictive πολιτική
-- select (<πίνακας>_case_scope). Οι υπάρχουσες πολιτικές δεν αλλάζουν.

alter table public.surveillance_devices
  add constraint surveillance_devices_id_organization_key unique (id, organization_id);
alter table public.patients
  add constraint patients_id_organization_key unique (id, organization_id);

alter table public.prevention_bundle_assessments
  add column if not exists patient_id uuid,
  add column if not exists surveillance_case_id uuid,
  add column if not exists surveillance_device_id uuid,
  add column if not exists device_day integer;
alter table public.prevention_bundle_assessments
  add constraint prevention_bundle_assessments_device_day_check check (device_day is null or device_day >= 1),
  add constraint prevention_bundle_assessments_patient_fk foreign key (patient_id, organization_id)
    references public.patients (id, organization_id) on delete set null (patient_id),
  add constraint prevention_bundle_assessments_case_fk foreign key (surveillance_case_id, organization_id)
    references public.surveillance_cases (id, organization_id) on delete set null (surveillance_case_id),
  add constraint prevention_bundle_assessments_device_fk foreign key (surveillance_device_id, organization_id)
    references public.surveillance_devices (id, organization_id) on delete set null (surveillance_device_id);

create index if not exists prevention_bundle_assessments_case_idx
  on public.prevention_bundle_assessments (surveillance_case_id, bundle_key, assessment_date desc)
  where surveillance_case_id is not null;
create index if not exists prevention_bundle_assessments_device_idx
  on public.prevention_bundle_assessments (surveillance_device_id) where surveillance_device_id is not null;
create index if not exists prevention_bundle_assessments_patient_idx
  on public.prevention_bundle_assessments (patient_id) where patient_id is not null;
create index if not exists prevention_bundle_assessments_case_org_idx
  on public.prevention_bundle_assessments (surveillance_case_id, organization_id) where surveillance_case_id is not null;

comment on column public.prevention_bundle_assessments.surveillance_case_id is 'Επεισόδιο επιτήρησης από το οποίο έγινε ο έλεγχος (null για έλεγχο ανά τμήμα).';
comment on column public.prevention_bundle_assessments.surveillance_device_id is 'Συσκευή που ελέγχθηκε (null για έλεγχο ανά τμήμα).';
comment on column public.prevention_bundle_assessments.device_day is 'Ημέρα της συσκευής κατά τον έλεγχο (1 = ημέρα τοποθέτησης, ώρα Ευρώπης/Αθήνας).';

create policy prevention_bundle_assessments_case_scope on public.prevention_bundle_assessments
  as restrictive for select to authenticated
  using (
    surveillance_case_id is null
    or exists (
      select 1 from public.surveillance_cases sc
      where sc.id = surveillance_case_id
        and sc.organization_id = prevention_bundle_assessments.organization_id
        and public.can_view_surveillance_record(sc.organization_id, sc.department_id)
    )
  );
