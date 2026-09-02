alter table public.microbiology_results drop constraint if exists microbiology_results_check;

create index if not exists idx_laboratory_samples_org_status
  on public.laboratory_samples(organization_id,status,created_at desc);
create index if not exists idx_microbiology_results_sample_validation
  on public.microbiology_results(sample_id,validation_status,resulted_at desc);
create index if not exists idx_ast_microbiology_result
  on public.antimicrobial_susceptibility_results(microbiology_result_id);
create index if not exists idx_critical_result_communications_microbiology
  on public.critical_result_communications(microbiology_result_id,communicated_at desc);
