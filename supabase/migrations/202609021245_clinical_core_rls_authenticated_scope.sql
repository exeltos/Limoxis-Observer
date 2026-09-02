-- Clinical core RLS must target authenticated users explicitly.
-- Existing predicates remain the source of truth for organization/department authorization.

alter policy patients_clinical_read on public.patients to authenticated;
alter policy patients_clinical_write on public.patients to authenticated;
alter policy patient_admissions_read on public.patient_admissions to authenticated;
alter policy patient_admissions_write on public.patient_admissions to authenticated;
alter policy surveillance_clinical_read on public.surveillance_cases to authenticated;
alter policy surveillance_cases_write on public.surveillance_cases to authenticated;
alter policy surveillance_events_clinical_read on public.surveillance_events to authenticated;
alter policy surveillance_events_write on public.surveillance_events to authenticated;
alter policy laboratory_samples_read on public.laboratory_samples to authenticated;
alter policy laboratory_samples_write on public.laboratory_samples to authenticated;

revoke all on table public.patients from anon;
revoke all on table public.patient_admissions from anon;
revoke all on table public.surveillance_cases from anon;
revoke all on table public.surveillance_events from anon;
revoke all on table public.laboratory_samples from anon;
