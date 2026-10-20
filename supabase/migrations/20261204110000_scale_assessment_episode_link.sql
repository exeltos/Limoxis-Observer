-- Φόρμες & ερωτηματολόγια, βήμα 2: η κλινική αξιολόγηση (κλίμακα) μπορεί να συνδεθεί με το
-- επεισόδιο επιτήρησης από το οποίο καταγράφηκε. Μόνο προσθήκη: nullable στήλη, οι σημερινές
-- αξιολογήσεις ανά ασθενή/νοσηλεία δεν αλλάζουν και οι πολιτικές RLS μένουν ως έχουν.
alter table public.patient_clinical_scale_assessments
  add column if not exists surveillance_case_id uuid;
alter table public.patient_clinical_scale_assessments
  add constraint patient_clinical_scale_assessments_case_fk foreign key (surveillance_case_id, organization_id)
    references public.surveillance_cases (id, organization_id) on delete set null (surveillance_case_id);
create index if not exists patient_clinical_scale_assessments_case_idx
  on public.patient_clinical_scale_assessments (surveillance_case_id, organization_id) where surveillance_case_id is not null;
comment on column public.patient_clinical_scale_assessments.surveillance_case_id is 'Επεισόδιο επιτήρησης από το οποίο έγινε η αξιολόγηση (null όταν γίνεται από τον φάκελο νοσηλείας).';
