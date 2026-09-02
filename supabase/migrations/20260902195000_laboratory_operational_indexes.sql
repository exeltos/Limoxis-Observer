create index if not exists laboratory_samples_org_patient_idx on public.laboratory_samples(organization_id, patient_id);
create index if not exists laboratory_samples_org_department_idx on public.laboratory_samples(organization_id, department_id) where department_id is not null;
create index if not exists microbiology_results_amended_from_idx on public.microbiology_results(amended_from) where amended_from is not null;
create index if not exists amr_classifications_result_idx on public.amr_classifications(microbiology_result_id);
